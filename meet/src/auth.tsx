import axios from "axios";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

type AuthUser = {
  id: string;
  _id: string;
  email: string;
  emailAddresses: Array<{ id: string; emailAddress: string }>;
  primaryEmailAddress: { id: string; emailAddress: string };
  firstName?: string;
  lastName?: string;
  fullName?: string;
  imageUrl?: string;
  publicMetadata?: Record<string, any>;
  sessions?: any[];
  loginHistory?: any[];
};

type AuthContextValue = {
  user: AuthUser | null;
  userId: string | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  getToken: () => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: { email: string; password: string; firstName?: string; lastName?: string; name?: string }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const TOKEN_KEY = "scriptopia.session";
const AuthContext = createContext<AuthContextValue | null>(null);
const apiBase = () => import.meta.env.VITE_API_URL as string;
const storedToken = () => window.localStorage.getItem(TOKEN_KEY);

const setSession = (token: string | null) => {
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
};

const client = () => axios.create({ baseURL: apiBase() });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const getToken = useCallback(async () => storedToken(), []);

  const refreshUser = useCallback(async () => {
    const token = storedToken();
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const res = await client().get("/users/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(res.data.data);
    } catch {
      setSession(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setIsLoaded(true));
  }, [refreshUser]);

  const applyAuthResponse = (data: any) => {
    setSession(data.token);
    setUser(data.user);
  };

  const signIn = async (email: string, password: string) => {
    const res = await client().post("/users/auth/login", { email, password });
    applyAuthResponse(res.data.data);
  };

  const signUp = async (payload: { email: string; password: string; firstName?: string; lastName?: string; name?: string }) => {
    const res = await client().post("/users/auth/register", payload);
    applyAuthResponse(res.data.data);
  };

  const signOut = async () => {
    const token = storedToken();
    setSession(null);
    setUser(null);
    if (token) {
      await client().post("/users/auth/logout", {}, { headers: { Authorization: `Bearer ${token}` } }).catch(() => undefined);
    }
  };

  const value = useMemo<AuthContextValue>(() => ({
    user,
    userId: user?._id || null,
    isLoaded,
    isSignedIn: Boolean(user),
    getToken,
    signIn,
    signUp,
    signOut,
    refreshUser,
  }), [getToken, isLoaded, refreshUser, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

export const useUser = () => {
  const context = useAuth();
  return { user: context.user, isLoaded: context.isLoaded, isSignedIn: context.isSignedIn };
};

export const SignedIn = ({ children }: { children: React.ReactNode }) => {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded || !isSignedIn) return null;
  return <>{children}</>;
};

export const SignedOut = ({ children }: { children: React.ReactNode }) => {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded || isSignedIn) return null;
  return <>{children}</>;
};

export const RedirectToSignIn = () => {
  const location = useLocation();
  return <Navigate to={`/auth/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
};

export const SignOutButton = ({
  children,
}: {
  children?: React.ReactNode;
  signOutOptions?: { redirectUrl?: string };
}) => {
  const { signOut } = useAuth();
  return <button type="button" onClick={() => signOut()}>{children || "Sign out"}</button>;
};

const UserButtonBase = ({ children }: { children?: React.ReactNode }) => {
  const { user, signOut } = useAuth();
  const initials = (user?.fullName || user?.email || "U").slice(0, 1).toUpperCase();
  return (
    <button
      type="button"
      onClick={() => signOut()}
      title="Sign out"
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm"
    >
      {user?.imageUrl ? <img src={user.imageUrl} alt="Account" className="h-full w-full rounded-full object-cover" /> : initials}
      <span className="sr-only">Account menu</span>
      <span className="hidden">{children}</span>
    </button>
  );
};

export const UserButton = Object.assign(UserButtonBase, {
  MenuItems: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  Action: ({ label, onClick }: { label?: string; labelIcon?: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{label}</button>
  ),
});

export const AuthPage = () => {
  const { signIn, signUp } = useAuth();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const redirect = params.get("redirect") || "/start";
  const [mode, setMode] = useState<"login" | "register" | "recover">(location.pathname.includes("register") ? "register" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      if (mode === "recover") {
        await client().post("/users/auth/forgot-password", { email });
        setMessage("If an account exists, recovery instructions are available.");
        return;
      }
      if (mode === "register") await signUp({ email, password, firstName, lastName });
      else await signIn(email, password);
      window.location.href = redirect;
    } catch (err: any) {
      setError(err.response?.data?.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-950">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-sm font-medium text-slate-500">Scriptopia Identity</p>
          <h1 className="mt-2 text-2xl font-semibold">{mode === "register" ? "Create your account" : mode === "recover" ? "Recover access" : "Sign in"}</h1>
        </div>
        {mode === "register" && (
          <div className="grid grid-cols-2 gap-3">
            <input className="h-11 rounded-md border border-slate-300 px-3 text-sm" placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <input className="h-11 rounded-md border border-slate-300 px-3 text-sm" placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        )}
        <input className="mt-3 h-11 w-full rounded-md border border-slate-300 px-3 text-sm" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        {mode !== "recover" && <input className="mt-3 h-11 w-full rounded-md border border-slate-300 px-3 text-sm" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />}
        {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {message && <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
        <button className="mt-5 h-11 w-full rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={loading}>
          {loading ? "Please wait" : mode === "register" ? "Create account" : mode === "recover" ? "Send recovery" : "Sign in"}
        </button>
        <div className="mt-5 flex items-center justify-between text-sm text-slate-600">
          <button type="button" onClick={() => setMode(mode === "register" ? "login" : "register")}>{mode === "register" ? "Sign in instead" : "Create account"}</button>
          <button type="button" onClick={() => setMode(mode === "recover" ? "login" : "recover")}>{mode === "recover" ? "Back to sign in" : "Forgot password?"}</button>
        </div>
      </form>
    </main>
  );
};
