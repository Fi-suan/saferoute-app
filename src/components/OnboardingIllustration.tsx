/**
 * OnboardingIllustration — Nothing Phone style SVG icons
 *
 * Thin-stroke geometric illustrations for onboarding slides.
 * Renders using react-native-svg (already installed).
 */
import React from 'react';
import Svg, {
    Circle, Line, Path, Rect, G,
    Defs, LinearGradient, Stop, Polygon,
} from 'react-native-svg';
import { Colors } from '../constants/colors';

interface Props {
    type: 'shield' | 'marker' | 'bell' | 'community' | 'profile';
    size?: number;
    color?: string;
}

export default function OnboardingIllustration({ type, size = 100, color = Colors.brand.primary }: Props) {
    const s = size;
    const c = s / 2;
    const sw = size * 0.025; // stroke width

    switch (type) {
        case 'shield':
            return (
                <Svg width={s} height={s} viewBox="0 0 100 100">
                    <Defs>
                        <LinearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor={color} stopOpacity="0.8" />
                            <Stop offset="1" stopColor={color} stopOpacity="0.2" />
                        </LinearGradient>
                    </Defs>
                    {/* Shield outline */}
                    <Path
                        d="M50 8 L82 22 L82 50 C82 68 66 82 50 90 C34 82 18 68 18 50 L18 22 Z"
                        fill="none"
                        stroke="url(#sg)"
                        strokeWidth={sw * 1.5}
                        strokeLinejoin="round"
                    />
                    {/* Check */}
                    <Path
                        d="M35 50 L45 60 L65 38"
                        fill="none"
                        stroke={color}
                        strokeWidth={sw * 2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    {/* Dot accents */}
                    <Circle cx={50} cy={22} r={2.5} fill={color} opacity={0.6} />
                    <Circle cx={82} cy={22} r={2} fill={color} opacity={0.4} />
                    <Circle cx={18} cy={22} r={2} fill={color} opacity={0.4} />
                </Svg>
            );

        case 'marker':
            return (
                <Svg width={s} height={s} viewBox="0 0 100 100">
                    {/* Pin body */}
                    <Path
                        d="M50 12 C36 12 24 24 24 38 C24 58 50 88 50 88 C50 88 76 58 76 38 C76 24 64 12 50 12 Z"
                        fill="none"
                        stroke={color}
                        strokeWidth={sw * 1.5}
                        strokeLinejoin="round"
                    />
                    {/* Inner circle */}
                    <Circle
                        cx={50}
                        cy={38}
                        r={10}
                        fill={color + '30'}
                        stroke={color}
                        strokeWidth={sw}
                    />
                    {/* Center dot */}
                    <Circle cx={50} cy={38} r={4} fill={color} />
                    {/* Radius rings */}
                    <Circle cx={50} cy={38} r={22} fill="none" stroke={color} strokeWidth={sw * 0.5} opacity={0.25} strokeDasharray="3 4" />
                    <Circle cx={50} cy={38} r={32} fill="none" stroke={color} strokeWidth={sw * 0.5} opacity={0.15} strokeDasharray="3 5" />
                </Svg>
            );

        case 'bell':
            return (
                <Svg width={s} height={s} viewBox="0 0 100 100">
                    {/* Bell */}
                    <Path
                        d="M50 14 C38 14 28 24 28 40 L28 62 L18 72 L82 72 L72 62 L72 40 C72 24 62 14 50 14 Z"
                        fill="none"
                        stroke={color}
                        strokeWidth={sw * 1.5}
                        strokeLinejoin="round"
                    />
                    {/* Clapper */}
                    <Path
                        d="M42 72 C42 77 46 82 50 82 C54 82 58 77 58 72"
                        fill="none"
                        stroke={color}
                        strokeWidth={sw * 1.2}
                        strokeLinecap="round"
                    />
                    {/* Stem at top */}
                    <Line x1={50} y1={8} x2={50} y2={14} stroke={color} strokeWidth={sw * 1.5} strokeLinecap="round" />
                    {/* Alert dot */}
                    <Circle cx={72} cy={26} r={7} fill={Colors.alert.critical} />
                    <Line x1={72} y1={23} x2={72} y2={28} stroke="white" strokeWidth={2.5} strokeLinecap="round" />
                    <Circle cx={72} cy={31} r={1.5} fill="white" />
                </Svg>
            );

        case 'community':
            return (
                <Svg width={s} height={s} viewBox="0 0 100 100">
                    {/* Three connected nodes */}
                    {/* Center node */}
                    <Circle cx={50} cy={50} r={9} fill={color + '20'} stroke={color} strokeWidth={sw * 1.2} />
                    <Circle cx={50} cy={50} r={3} fill={color} />
                    {/* Top-left node */}
                    <Circle cx={22} cy={28} r={7} fill={color + '15'} stroke={color} strokeWidth={sw} opacity={0.7} />
                    <Circle cx={22} cy={28} r={2.5} fill={color} opacity={0.7} />
                    {/* Top-right node */}
                    <Circle cx={78} cy={28} r={7} fill={color + '15'} stroke={color} strokeWidth={sw} opacity={0.7} />
                    <Circle cx={78} cy={28} r={2.5} fill={color} opacity={0.7} />
                    {/* Bottom node */}
                    <Circle cx={50} cy={78} r={7} fill={color + '15'} stroke={color} strokeWidth={sw} opacity={0.7} />
                    <Circle cx={50} cy={78} r={2.5} fill={color} opacity={0.7} />
                    {/* Connecting lines */}
                    <Line x1={50} y1={41} x2={28} y2={33} stroke={color} strokeWidth={sw * 0.8} strokeLinecap="round" opacity={0.4} />
                    <Line x1={50} y1={41} x2={72} y2={33} stroke={color} strokeWidth={sw * 0.8} strokeLinecap="round" opacity={0.4} />
                    <Line x1={50} y1={59} x2={50} y2={71} stroke={color} strokeWidth={sw * 0.8} strokeLinecap="round" opacity={0.4} />
                    {/* Pulse rings on center */}
                    <Circle cx={50} cy={50} r={18} fill="none" stroke={color} strokeWidth={sw * 0.4} opacity={0.2} />
                    <Circle cx={50} cy={50} r={28} fill="none" stroke={color} strokeWidth={sw * 0.3} opacity={0.1} />
                </Svg>
            );

        case 'profile':
            return (
                <Svg width={s} height={s} viewBox="0 0 100 100">
                    {/* Head */}
                    <Circle cx={50} cy={36} r={18} fill="none" stroke={color} strokeWidth={sw * 1.5} />
                    {/* Body / shoulders */}
                    <Path
                        d="M16 88 C16 68 30 58 50 58 C70 58 84 68 84 88"
                        fill="none"
                        stroke={color}
                        strokeWidth={sw * 1.5}
                        strokeLinecap="round"
                    />
                    {/* Tick / verify badge */}
                    <Circle cx={72} cy={28} r={10} fill={Colors.bg.secondary} stroke={color} strokeWidth={sw * 1.2} />
                    <Path
                        d="M67 28 L70 31 L77 24"
                        fill="none"
                        stroke={color}
                        strokeWidth={sw * 1.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </Svg>
            );

        default:
            return null;
    }
}
