import type { Metadata } from 'next';
import { MantineProvider, ColorSchemeScript } from '@mantine/core';
import '@mantine/core/styles.css';
import './globals.css';

export const metadata: Metadata = {
    title: '산업단지 지도 시각화',
    description: '인천 남동구 산업단지 부동산 정보 시각화',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ko" suppressHydrationWarning>
            <head>
                <ColorSchemeScript />
                <script
                    type="text/javascript"
                    src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=uhwy1pqwqr&submodules=gl"
                />
            </head>
            <body>
                <MantineProvider>
                    {children}
                </MantineProvider>
            </body>
        </html>
    );
}
