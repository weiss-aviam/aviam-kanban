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
import { Mail, Lock, User, Loader2 } from "lucide-react";
import {
  AVIAM_EMAIL_DOMAIN,
  getAviamEmailError,
  isAviamEmail,
  normalizeEmail,
} from "../../../lib/auth-email";
import { createClient } from "../../../lib/supabase/client";

const AUTH_ERRORS: Record<string, string> = {
  "User already registered": "Diese E-Mail-Adresse ist bereits registriert.",
  "Password should be at least 6 characters":
    "Das Passwort muss mindestens 6 Zeichen lang sein.",
  "Unable to validate email address":
    "Die E-Mail-Adresse konnte nicht validiert werden.",
  "Too many requests":
    "Zu viele Anfragen. Bitte versuchen Sie es später erneut.",
};

function translateError(msg: string): string {
  for (const [key, translation] of Object.entries(AUTH_ERRORS)) {
    if (msg.toLowerCase().includes(key.toLowerCase())) return translation;
  }
  return "Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.";
}

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const normalizedEmail = normalizeEmail(email);
    setEmail(normalizedEmail);

    if (!isAviamEmail(normalizedEmail)) {
      setError(getAviamEmailError());
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: { name },
        },
      });

      if (error) {
        setError(translateError(error.message));
        return;
      }

      if (data.user && !data.user.email_confirmed_at) {
        setSuccess(
          "Bitte prüfen Sie Ihr Postfach und bestätigen Sie Ihre E-Mail-Adresse.",
        );
      } else {
        router.push("/dashboard");
      }
    } catch (_err) {
      setError(
        "Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",
      );
    } finally {
      setIsLoading(false);
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

        {/* Sign Up Form */}
        <Card>
          <CardHeader>
            <CardTitle>Konto erstellen</CardTitle>
            <CardDescription>
              Erstellen Sie Ihr Konto. Nur @{AVIAM_EMAIL_DOMAIN}-Adressen sind
              zugelassen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Vollständiger Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Vor- und Nachname"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder={`name@${AVIAM_EMAIL_DOMAIN}`}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Nur @{AVIAM_EMAIL_DOMAIN}-Adressen können sich registrieren.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Passwort</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Passwort erstellen"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    minLength={6}
                    required
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Das Passwort muss mindestens 6 Zeichen lang sein.
                </p>
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

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Konto wird erstellt...
                  </>
                ) : (
                  "Konto erstellen"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Bereits ein Konto?{" "}
                <Link
                  href="/auth/login"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Anmelden
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
