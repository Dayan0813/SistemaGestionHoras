import { ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

export default function AuthLayout({ children }: Props) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100">
            <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">{children}</div>
        </div>
    );
}
