import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "player@example.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (typeof credentials?.email !== "string" || typeof credentials?.password !== "string" || !credentials.email || !credentials.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.trim().toLowerCase() }
        });
        

        if (!user || !user.password) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );
        

        if (!isPasswordValid) {
          return null;
        }


        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id as string;
      } else {
        if (!token.id) return null;
        const current = await prisma.user.findUnique({
          where: { id: token.id }, select: { id: true, role: true, name: true, email: true },
        });
        if (!current) return null;
        token.role = current.role;
        token.name = current.name;
        token.email = current.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.name = token.name;
        session.user.email = token.email || "";
        session.user.role = token.role;
        session.user.id = token.id;
      }
      return session;
    }
  },
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  }
})
