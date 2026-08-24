import { type NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { createAdminClient } from './supabase';

const ADMIN_EMAILS = [
  'mapping.procimec2024@gmail.com',
  'marcelobarrazasantiago@gmail.com',
];

function isKnownAdmin(email: string): boolean {
  if (!email) return false;
  const envAdmin = process.env.GOOGLE_DRIVE_ADMIN_EMAIL;
  if (envAdmin && email.toLowerCase() === envAdmin.toLowerCase()) return true;
  return ADMIN_EMAILS.some((e) => e.toLowerCase() === email.toLowerCase());
}

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
      const isAdmin = isKnownAdmin(user.email);

      // Check if user exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, role, is_active')
        .eq('email', user.email)
        .single();

      if (!existingUser) {
        // Create new user with 'admin' if in admin list, otherwise 'pending'
        const { error } = await supabase.from('users').insert({
          email: user.email,
          full_name: user.name || profile?.name || 'Usuario',
          avatar_url: user.image || null,
          role: isAdmin ? 'admin' : 'pending',
          is_active: true,
        });
        if (error) {
          console.error('Error creating user:', error);
          return false;
        }
      } else {
        if (!existingUser.is_active) {
          return '/pending?reason=inactive';
        }
        // Si es correo admin pero en la BD aun figura como pending, actualizarlo a admin automaticamente
        if (isAdmin && existingUser.role !== 'admin') {
          await supabase.from('users').update({ role: 'admin' }).eq('email', user.email);
        }
      }

      // ── Si es el admin y viene con refresh_token, guardarlo en Supabase ──
      if (
        account?.refresh_token &&
        isKnownAdmin(user.email)
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

      const email = user?.email || (token?.email as string | undefined);

      if (email) {
        const supabase = createAdminClient();
        const isAdmin = isKnownAdmin(email);

        const { data } = await supabase
          .from('users')
          .select('id, role, is_active, full_name, avatar_url')
          .eq('email', email)
          .single();

        if (data) {
          const effectiveRole = isAdmin ? 'admin' : data.role;
          token.userId = data.id;
          token.role = effectiveRole;
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
    signIn: '/login',
    error: '/login',
  },
};
