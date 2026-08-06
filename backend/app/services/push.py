"""
Отправка push-уведомлений через Expo Push Service.

Клиент получает токен вызовом getExpoPushTokenAsync() и кладёт его в
devices.fcm_token. Имя колонки историческое: хранится там токен Expo вида
`ExponentPushToken[...]`, а не сырой токен FCM.

Expo Push API не требует ключей: маршрутизацию в FCM/APNs берёт на себя Expo,
поэтому на бэкенде не нужны ни service account, ни firebase-admin.

Модуль намеренно не бросает исключений наружу: провал рассылки не должен
ронять обновление позиции стада.
"""
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

# Expo принимает не больше 100 сообщений за запрос.
MAX_BATCH = 100

REQUEST_TIMEOUT_S = 10.0

# Подменяется в тестах, чтобы не ходить в сеть.
_transport: httpx.BaseTransport | None = None


def set_transport(transport: httpx.BaseTransport | None) -> None:
    """Точка внедрения для тестов."""
    global _transport
    _transport = transport


def is_expo_token(token: str | None) -> bool:
    """
    Похоже ли значение на токен Expo.

    В Expo Go токен не выдаётся, и клиент регистрируется без него — такие
    устройства просто пропускаем, а не отправляем в Expo заведомый мусор.
    """
    if not token:
        return False
    return token.startswith(("ExponentPushToken[", "ExpoPushToken["))


def build_message(
    token: str,
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "to": token,
        "title": title,
        "body": body,
        "data": data or {},
        "sound": "default",
        # Предупреждение об опасности на дороге не должно ждать в очереди,
        # пока система решит разбудить устройство.
        "priority": "high",
        # Канал заведён клиентом в services/notifications.ts.
        "channelId": "saferoute-alerts",
    }


def _post_batch(batch: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Отправляет одну пачку и возвращает талоны Expo (по одному на сообщение)."""
    with httpx.Client(timeout=REQUEST_TIMEOUT_S, transport=_transport) as client:
        resp = client.post(
            EXPO_PUSH_URL,
            json=batch,
            headers={"Accept": "application/json", "Content-Type": "application/json"},
        )
    if resp.status_code != 200:
        logger.warning("Expo push вернул %s: %s", resp.status_code, resp.text[:200])
        return []
    payload = resp.json()
    tickets = payload.get("data")
    return tickets if isinstance(tickets, list) else []


def send_messages(messages: list[dict[str, Any]]) -> tuple[int, list[str]]:
    """
    Отправляет сообщения пачками.

    @returns (сколько принято, токены устройств, которых больше нет)

    Токены с ошибкой DeviceNotRegistered возвращаются, чтобы вызывающий код
    их вычистил: приложение удалено, слать туда больше нечего.
    """
    if not messages:
        return 0, []

    accepted = 0
    dead_tokens: list[str] = []

    for start in range(0, len(messages), MAX_BATCH):
        batch = messages[start:start + MAX_BATCH]
        try:
            tickets = _post_batch(batch)
        except httpx.HTTPError as e:
            logger.warning("Пачка push не ушла: %s", e)
            continue

        # Талоны приходят в том же порядке, что и сообщения.
        for message, ticket in zip(batch, tickets, strict=False):
            if ticket.get("status") == "ok":
                accepted += 1
                continue
            error = (ticket.get("details") or {}).get("error")
            if error == "DeviceNotRegistered":
                dead_tokens.append(message["to"])
            else:
                logger.warning("Expo отклонил сообщение: %s", ticket.get("message"))

    return accepted, dead_tokens
