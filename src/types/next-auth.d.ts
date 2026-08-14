import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      isActive: boolean;
      fullName: string;
      avatarUrl?: string;
    };
  }

  interface User {
    id: string;
    role?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    role?: string;
    isActive?: boolean;
    fullName?: string;
    avatarUrl?: string;
  }
}
