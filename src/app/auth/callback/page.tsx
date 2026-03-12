"use client";

import { Suspense, useEffect, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import { t } from "../../../lib/i18n";
import { Loader2, CheckCircle, Clock, XCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import Link from "next/link";

function AuthCallbackInner() {
  const [status, setStatus] = useState<
    "loading" | "success" | "pending" | "error"
  >("loading");
  const [message, setMessage] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const code = searchParams.get("code");
        const error = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");

        if (error) {
          setStatus("error");
          setMessage(errorDescription || "Authentication failed");
          return;
        }

        const tokenHash = searchParams.get("token_hash");
        const tokenType = searchParams.get("type");

        // Prefer token_hash verification (works in any browser, no PKCE state
        // needed) over the PKCE code flow. token_hash is available when the
        // Supabase email template is configured to link directly to the app
        // rather than routing through the Supabase verify endpoint.
        const sessionResult =
          tokenHash && tokenType
            ? await supabase.auth.verifyOtp({
                token_hash: tokenHash,
                type: tokenType as EmailOtpType,
              })
            : code
              ? await supabase.auth.exchangeCodeForSession(code)
              : null;

        if (sessionResult) {
          if (sessionResult.error) {
            setStatus("error");
            const msg = sessionResult.error.message;
            const isPkceError =
              msg.toLowerCase().includes("pkce") ||
              msg.toLowerCase().includes("code verifier") ||
              msg.toLowerCase().includes("verifier");
            setMessage(isPkceError ? t("authCallback.pkceError") : msg);
            return;
          }

          if (sessionResult.data.user) {
            // Promote unconfirmed users to pending and ban them at the auth
            // layer. For admin-created / already-active users this is a no-op.
            const confirmRes = await fetch("/api/auth/confirm-email", {
              method: "POST",
            });

            let userStatus = "pending"; // default: block unless explicit "active"
            try {
              const confirmData = await confirmRes.json();
              userStatus = confirmData.status ?? "pending";
            } catch {
              // JSON parse failed — treat as pending
            }

            if (userStatus !== "active") {
              await supabase.auth.signOut();
              if (userStatus === "deactivated") {
                setStatus("error");
                setMessage(t("authCallback.errorMessage"));
              } else {
                setStatus("pending");
                setMessage(t("authCallback.pendingApprovalMessage"));
              }
            } else {
              setStatus("success");
              setMessage(t("authCallback.successAuth"));
              setTimeout(() => router.push("/dashboard"), 2000);
            }
          }
        } else {
          const {
            data: { user },
            error: userError,
          } = await supabase.auth.getUser();

          if (userError) {
            setStatus("error");
            setMessage(userError.message);
            return;
          }

          if (user) {
            setStatus("success");
            setMessage(t("authCallback.alreadyAuth"));
            setTimeout(() => {
              router.push("/dashboard");
            }, 1000);
          } else {
            setStatus("error");
            setMessage(t("authCallback.noCodeFound"));
          }
        }
      } catch (err) {
        setStatus("error");
        setMessage(t("authCallback.unexpectedError"));
        console.error("Auth callback error:", err);
      }
    };

    handleAuthCallback();
  }, [searchParams, router, supabase.auth]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {status === "loading" && (
                <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
              )}
              {status === "success" && (
                <CheckCircle className="h-12 w-12 text-green-600" />
              )}
              {status === "pending" && (
                <Clock className="h-12 w-12 text-amber-500" />
              )}
              {status === "error" && (
                <XCircle className="h-12 w-12 text-red-600" />
              )}
            </div>
            <CardTitle>
              {status === "loading" && t("authCallback.authenticating")}
              {status === "success" && t("authCallback.successTitle")}
              {status === "pending" && t("authCallback.pendingApprovalTitle")}
              {status === "error" && t("authCallback.errorTitle")}
            </CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
          <CardContent>
            {status === "loading" && (
              <div className="text-center">
                <p className="text-sm text-gray-600">
                  {t("authCallback.waitMessage")}
                </p>
              </div>
            )}

            {status === "success" && (
              <div className="text-center space-y-4">
                <p className="text-sm text-gray-600">
                  {t("authCallback.successMessage")}
                </p>
                <Button asChild className="w-full">
                  <Link href="/dashboard">
                    {t("authCallback.goToDashboard")}
                  </Link>
                </Button>
              </div>
            )}

            {status === "pending" && (
              <div className="text-center space-y-4">
                <Button asChild variant="outline" className="w-full">
                  <Link href="/auth/login">
                    {t("authCallback.pendingApprovalAction")}
                  </Link>
                </Button>
              </div>
            )}

            {status === "error" && (
              <div className="text-center space-y-4">
                <p className="text-sm text-gray-600">
                  {t("authCallback.errorMessage")}
                </p>
                <div className="flex flex-col space-y-2">
                  <Button asChild variant="default">
                    <Link href="/auth/login">{t("authCallback.tryAgain")}</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/">{t("authCallback.backToHome")}</Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
