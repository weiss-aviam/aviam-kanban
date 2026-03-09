"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Alert, AlertDescription } from "../../../components/ui/alert";
import { Kanban, Lock, Loader2 } from "lucide-react";
import { createClient } from "../../../lib/supabase/client";
import { t } from "../../../lib/i18n";

function ResetPasswordInner() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();
  const _searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    const checkSession = async () => {
      try {
        // Check if user has a valid session
        const {
          data: { session },
        } = await supabase.auth.getSession();
        console.log("Current session:", session);

        if (session?.user) {
          // User has a session, allow them to reset their password
          // This works for both recovery sessions and regular authenticated users
          console.log("User has session, showing password reset form");
          setIsInitializing(false);
          return;
        }

        // Check URL hash for recovery tokens (from password reset email)
        const hashParams = new URLSearchParams(
          window.location.hash.substring(1),
        );
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const type = hashParams.get("type");

        console.log("URL hash params:", {
          accessToken: !!accessToken,
          refreshToken: !!refreshToken,
          type,
        });

        if (accessToken && refreshToken && type === "recovery") {
          try {
            // Set the session using the recovery tokens
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) {
              console.error("Error setting session:", error);
              setError(t("resetPassword.invalidLink"));
              setIsInitializing(false);
              return;
            }

            // Session established, show the form
            setIsInitializing(false);
            return;
          } catch (err) {
            console.error("Session setup error:", err);
            setError(t("resetPassword.failedToEstablishSession"));
            setIsInitializing(false);
            return;
          }
        }

        // No session and no recovery tokens
        setError(t("resetPassword.useLinkFromEmail"));
        setIsInitializing(false);
      } catch (err) {
        console.error("Session check error:", err);
        setError(t("resetPassword.failedToVerify"));
        setIsInitializing(false);
      }
    };

    // Also listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        // User signed in (including from recovery), show the form
        setIsInitializing(false);
      }
    });

    checkSession();

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [supabase.auth]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError(t("resetPassword.passwordsDoNotMatch"));
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError(t("resetPassword.passwordMinLength"));
      setIsLoading(false);
      return;
    }

    try {
      console.log("Attempting to update password...");
      const { data, error } = await supabase.auth.updateUser({ password });

      if (error) {
        console.error("Password update error:", error);
        setError(error.message);
        return;
      }

      console.log("Password updated successfully:", data);

      setSuccess(t("resetPassword.passwordUpdated"));

      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (_err) {
      setError(t("resetPassword.unexpectedError"));
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state while initializing session
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 text-blue-600 mb-4 animate-spin" />
              <p className="text-gray-600">{t("resetPassword.initializing")}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Kanban className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">
              {t("resetPassword.aviamKanban")}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t("resetPassword.title")}
          </h1>
          <p className="text-gray-600">{t("resetPassword.subtitle")}</p>
        </div>

        {/* Reset Password Form */}
        <Card>
          <CardHeader>
            <CardTitle>{t("resetPassword.setNewPassword")}</CardTitle>
            <CardDescription>
              {t("resetPassword.chooseStrongPassword")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
              {/* New Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password">
                  {t("resetPassword.newPasswordLabel")}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder={t("resetPassword.newPasswordPlaceholder")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    minLength={6}
                    required
                  />
                </div>
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">
                  {t("resetPassword.confirmPasswordLabel")}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder={t("resetPassword.confirmPasswordPlaceholder")}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    minLength={6}
                    required
                  />
                </div>
                <p className="text-xs text-gray-500">
                  {t("resetPassword.passwordMinLength")}
                </p>
              </div>

              {/* Error/Success Messages */}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert>
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || (!!error && !password)}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("resetPassword.updatingPassword")}
                  </>
                ) : (
                  t("resetPassword.updatePassword")
                )}
              </Button>
            </form>

            {/* Back to Login Link */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                {t("resetPassword.rememberPassword")}{" "}
                <Link
                  href="/auth/login"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  {t("resetPassword.signIn")}
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}
