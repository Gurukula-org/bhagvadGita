import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { toast } from "sonner";
import { auth, googleProvider, db, isConfigured } from "@/lib/firebase";

interface AuthContextValue {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAdmin: false,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const ADMIN_DOMAINS = ["gurukula.com"];

async function checkIsAdmin(email: string): Promise<boolean> {
  const domain = email.split("@")[1];

  if (ADMIN_DOMAINS.includes(domain)) return true;

  if (!db) return false;
  try {
    const snap = await getDoc(doc(db, "gita_config", "admin_emails"));
    if (!snap.exists()) return false;
    const data = snap.data();
    const emails: string[] = data.emails ?? [];
    const domains: string[] = data.allowed_domains ?? [];
    return emails.includes(email) || domains.includes(domain);
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(typeof window !== "undefined");

  useEffect(() => {
    if (!isConfigured || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser?.email) {
        const admin = await checkIsAdmin(firebaseUser.email);
        if (admin) {
          setUser(firebaseUser);
          setIsAdmin(true);
        } else {
          await firebaseSignOut(auth!);
          setUser(null);
          setIsAdmin(false);
          toast.error("Access denied — not an authorized admin");
        }
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = useCallback(async () => {
    if (!auth || !googleProvider) {
      toast.error("Firebase is not configured");
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Sign-in failed";
      toast.error(message);
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!auth) return;
    await firebaseSignOut(auth);
    toast.success("Signed out");
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
