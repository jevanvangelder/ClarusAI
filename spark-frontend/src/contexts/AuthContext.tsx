import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type UserRole = 'admin' | 'school_admin' | 'teacher' | 'student'

interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  avatar_url: string | null
  school: string | null
}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  role: UserRole | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string, role?: UserRole) => Promise<{ error: any }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) { console.error('Fout bij ophalen profiel:', error); return }
      if (data) { setProfile(data); setRole(data.role) }
    } catch (err) {
      console.error('Onverwachte fout bij ophalen profiel:', err)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && !session.user.email_confirmed_at) {
        setLoading(false)
        return
      }
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user && !session.user.email_confirmed_at) {
        setLoading(false)
        return
      }
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setRole(null) }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signUp = async (email: string, password: string, role: UserRole = 'student') => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { role: role } // ← rol wordt opgeslagen in raw_user_meta_data → trigger pakt dit op
        }
      })
      console.log('signUp result:', { data, error })

      // Negeer "Error sending confirmation email" — account is WEL aangemaakt
      if (error && !error.message?.includes('sending confirmation email')) {
        return { error }
      }

      return { error: null }
    } catch (err: any) {
      console.error('signUp crash:', err)
      return { error: err }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const value = { user, session, profile, role, loading, signIn, signUp, signOut }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider')
  return context
}