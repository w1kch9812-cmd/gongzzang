// components/analysis/LazyCharts.tsx - 차트 동적 임포트

'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@mantine/core';

// Recharts를 동적 임포트 (번들 크기 최적화)
export const LineChart = dynamic(
    () => import('recharts').then(mod => mod.LineChart),
    { ssr: false, loading: () => <Skeleton height={300} /> }
);

export const Line = dynamic(
    () => import('recharts').then(mod => mod.Line),
    { ssr: false }
);

export const BarChart = dynamic(
    () => import('recharts').then(mod => mod.BarChart),
    { ssr: false, loading: () => <Skeleton height={300} /> }
);

export const Bar = dynamic(
    () => import('recharts').then(mod => mod.Bar),
    { ssr: false }
);

export const PieChart = dynamic(
    () => import('recharts').then(mod => mod.PieChart),
    { ssr: false, loading: () => <Skeleton height={400} /> }
);

export const Pie = dynamic(
    () => import('recharts').then(mod => mod.Pie),
    { ssr: false }
);

export const Cell = dynamic(
    () => import('recharts').then(mod => mod.Cell),
    { ssr: false }
);

export const XAxis = dynamic(
    () => import('recharts').then(mod => mod.XAxis),
    { ssr: false }
);

export const YAxis = dynamic(
    () => import('recharts').then(mod => mod.YAxis),
    { ssr: false }
);

export const CartesianGrid = dynamic(
    () => import('recharts').then(mod => mod.CartesianGrid),
    { ssr: false }
);

export const Tooltip = dynamic(
    () => import('recharts').then(mod => mod.Tooltip),
    { ssr: false }
);

export const Legend = dynamic(
    () => import('recharts').then(mod => mod.Legend),
    { ssr: false }
);

export const ResponsiveContainer = dynamic(
    () => import('recharts').then(mod => mod.ResponsiveContainer),
    { ssr: false }
);
