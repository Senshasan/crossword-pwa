import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { createClient } from "@/lib/supabase/client";

export function useAuth(supabase: ReturnType<typeof createClient>) {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(async ({ data }) => {
      if (!mounted) return;
      setUser(data.user);
      if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", data.user.id)
          .maybeSingle();
        if (profile?.display_name) {
          setName(profile.display_name);
          setProfileReady(true);
        }
      }
      // Fix NEW-3 (Auth Flash): Only set authChecked to true after getUser resolves
      setAuthChecked(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (!session) {
          setProfileReady(false);
          setName("");
        }
      },
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function saveProfile(value: string) {
    if (!user || !value.trim()) return;
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, display_name: value.trim() });
    if (!error) {
      setName(value.trim());
      setProfileReady(true);
    }
  }

  return { user, authChecked, profileReady, name, saveProfile };
}
