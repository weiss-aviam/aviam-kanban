"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Mail, Lock, Loader2, Link2, KeyRound, X } from "lucide-react";
import { createClient } from "../../../lib/supabase/client";

const AUTH_ERRORS: Record<string, string> = {
  "Invalid login credentials":
    "Ungültige Anmeldedaten. Bitte überprüfen Sie E-Mail und Passwort.",
  "Email not confirmed":
    "E-Mail-Adresse noch nicht bestätigt. Bitte prüfen Sie Ihr Postfach.",
  "Too many requests":
    "Zu viele Anfragen. Bitte versuchen Sie es später erneut.",
  "User not found": "Kein Konto mit dieser E-Mail-Adresse gefunden.",
};

function translateError(msg: string): string {
  for (const [key, translation] of Object.entries(AUTH_ERRORS)) {
    if (msg.toLowerCase().includes(key.toLowerCase())) return translation;
  }
  return "Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<
    "signin" | "magic" | "reset" | null
  >(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForgotOptions, setShowForgotOptions] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoadingAction("signin");
    setError("");
    setSuccess("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(translateError(error.message));
        return;
      }

      if (data.user) {
        router.push("/dashboard");
      }
    } catch (_err) {
      setError(
        "Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",
      );
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  const handleMagicLink = async () => {
    if (!email) {
      setError("Bitte geben Sie zuerst Ihre E-Mail-Adresse ein.");
      return;
    }

    setIsLoading(true);
    setLoadingAction("magic");
    setError("");
    setSuccess("");

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH || ""}/dashboard`,
        },
      });

      if (error) {
        setError(translateError(error.message));
      } else {
        setSuccess(
          "Magischer Anmeldelink wurde gesendet. Bitte prüfen Sie Ihr Postfach.",
        );
        setShowForgotOptions(false);
      }
    } catch (_err) {
      setError(
        "Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",
      );
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setError("Bitte geben Sie zuerst Ihre E-Mail-Adresse ein.");
      return;
    }

    setIsLoading(true);
    setLoadingAction("reset");
    setError("");
    setSuccess("");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH || ""}/auth/reset-password`,
      });

      if (error) {
        setError(translateError(error.message));
      } else {
        setSuccess(
          "E-Mail zum Zurücksetzen des Passworts wurde gesendet. Bitte prüfen Sie Ihr Postfach.",
        );
        setShowForgotOptions(false);
      }
    } catch (_err) {
      setError(
        "Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",
      );
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image
            src="/aviam_logo.svg"
            alt="Aviam"
            width={180}
            height={53}
            priority
          />
        </div>

        {/* Sign In Form */}
        <Card>
          <CardHeader>
            <CardTitle>Anmelden</CardTitle>
            <CardDescription>
              Melden Sie sich mit Ihren Zugangsdaten an.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="ihre@email.de"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Passwort</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Ihr Passwort"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotOptions((v) => !v);
                    setError("");
                    setSuccess("");
                  }}
                  className="cursor-pointer text-sm text-blue-600 hover:text-blue-700"
                  disabled={isLoading}
                >
                  Passwort vergessen?
                </button>
              </div>

              {/* Forgot password options panel */}
              {showForgotOptions && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">
                      Wie möchten Sie fortfahren?
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowForgotOptions(false)}
                      className="cursor-pointer text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="justify-start gap-2 bg-white"
                      onClick={handleMagicLink}
                      disabled={isLoading}
                    >
                      {loadingAction === "magic" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Link2 className="h-4 w-4" />
                      )}
                      <span className="flex flex-col items-start text-left">
                        <span className="font-medium">
                          Magischen Anmeldelink senden
                        </span>
                        <span className="text-xs text-gray-500 font-normal">
                          Einmaligen Link zum direkten Einloggen erhalten
                        </span>
                      </span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="justify-start gap-2 bg-white"
                      onClick={handlePasswordReset}
                      disabled={isLoading}
                    >
                      {loadingAction === "reset" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <KeyRound className="h-4 w-4" />
                      )}
                      <span className="flex flex-col items-start text-left">
                        <span className="font-medium">
                          Passwort zurücksetzen
                        </span>
                        <span className="text-xs text-gray-500 font-normal">
                          Link zum Festlegen eines neuen Passworts erhalten
                        </span>
                      </span>
                    </Button>
                  </div>
                </div>
              )}

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

              <Button type="submit" className="w-full" disabled={isLoading}>
                {loadingAction === "signin" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Anmelden...
                  </>
                ) : (
                  "Anmelden"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Noch kein Konto?{" "}
                <Link
                  href="/auth/signup"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Registrieren
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
