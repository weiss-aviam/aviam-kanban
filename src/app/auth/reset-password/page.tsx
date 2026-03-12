"use client";

import { Suspense, useState, useEffect } from "react";
import Image from "next/image";
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
import { Lock, Loader2 } from "lucide-react";
import { createClient } from "../../../lib/supabase/client";
import { validatePassword } from "../../../lib/password";
import { t } from "../../../lib/i18n";

function ResetPasswordInner() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    const initSession = async () => {
      const code = searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setError(t("resetPassword.invalidLink"));
          setIsInitializing(false);
          return;
        }

        // Ensure the account is active — pending/deactivated users must not
        // obtain a working session through the password-reset flow.
        const confirmRes = await fetch("/api/auth/confirm-email", {
          method: "POST",
        });
        const confirmData = await confirmRes.json();
        const accountStatus: string = confirmData.status ?? "active";
        if (accountStatus !== "active") {
          await supabase.auth.signOut();
          setError(
            accountStatus === "deactivated"
              ? t("login.deactivatedMessage")
              : t("login.pendingMessage"),
          );
        }

        setIsInitializing(false);
        return;
      }

      // No code — check if there's already a valid session (e.g. user navigated back)
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        setIsInitializing(false);
        return;
      }

      setError(t("resetPassword.useLinkFromEmail"));
      setIsInitializing(false);
    };

    initSession();
  }, [searchParams, supabase.auth]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError(t("resetPassword.passwordsDoNotMatch"));
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setError(t("resetPassword.passwordRequirements"));
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setError(error.message);
        return;
      }

      setSuccess(t("resetPassword.passwordUpdated"));
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch (_err) {
      setError(t("resetPassword.unexpectedError"));
    } finally {
      setIsLoading(false);
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-blue-600 mb-4 animate-spin" />
            <p className="text-gray-600">{t("resetPassword.initializing")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Image
            src="/aviam_logo.svg"
            alt="Aviam"
            width={180}
            height={53}
            priority
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("resetPassword.setNewPassword")}</CardTitle>
            <CardDescription>
              {t("resetPassword.chooseStrongPassword")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
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
                    required
                    disabled={!!error && !password}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  {t("resetPassword.passwordRequirements")}
                </p>
              </div>

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
                    required
                    disabled={!!error && !password}
                  />
                </div>
              </div>

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
