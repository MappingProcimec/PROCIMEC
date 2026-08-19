import { type NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { createAdminClient } from './supabase';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
          // Solicitar permisos de Drive al admin
          scope: 'openid email profile https://www.googleapis.com/auth/drive',
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) return false;

      const supabase = createAdminClient();

      // Check if user exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, role, is_active')
        .eq('email', user.email)
        .single();

      if (!existingUser) {
        // Create new user with 'pending' role
        const { error } = await supabase.from('users').insert({
          email: user.email,
          full_name: user.name || profile?.name || 'Usuario',
          avatar_url: user.image || null,
          role: 'pending',
          is_active: true,
        });
        if (error) {
          console.error('Error creating user:', error);
          return false;
        }
      } else if (!existingUser.is_active) {
        return '/pending?reason=inactive';
      }

      // ── Si es el admin y viene con refresh_token, guardarlo en Supabase ──
      if (
        account?.refresh_token &&
        user.email === process.env.GOOGLE_DRIVE_ADMIN_EMAIL
      ) {
        await supabase
          .from('users')
          .update({ drive_refresh_token: account.refresh_token })
          .eq('email', user.email);

        console.log('✅ Admin Drive refresh_token guardado en Supabase');
      }

      return true;
    },

    async jwt({ token, user, trigger, session }) {
      if (trigger === 'update' && session) {
        return { ...token, ...session.user };
      }

      if (user?.email) {
        const supabase = createAdminClient();
        const { data } = await supabase
          .from('users')
          .select('id, role, is_active, full_name, avatar_url')
          .eq('email', user.email)
          .single();

        if (data) {
          token.userId = data.id;
          token.role = data.role;
          token.isActive = data.is_active;
          token.fullName = data.full_name;
          token.avatarUrl = data.avatar_url;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.userId as string;
        session.user.role = token.role as string;
        session.user.isActive = token.isActive as boolean;
        session.user.fullName = token.fullName as string;
        session.user.avatarUrl = token.avatarUrl as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/',
    error: '/',
  },
};
