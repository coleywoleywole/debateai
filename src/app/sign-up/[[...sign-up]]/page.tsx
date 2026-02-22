import { SignUp } from '@clerk/nextjs';
import Header from '@/components/Header';

export default function SignUpPage() {
  return (
    <div className="min-h-dvh flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center p-4">
        <SignUp />
      </main>
    </div>
  );
}
