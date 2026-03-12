"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
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
import { Mail, Lock, User, Loader2, CheckCircle } from "lucide-react";
import {
  isAllowedEmail,
  getEmailError,
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
  const [registered, setRegistered] = useState(false);
  const supabase = createClient();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const normalizedEmail = normalizeEmail(email);
    setEmail(normalizedEmail);

    if (!isAllowedEmail(normalizedEmail)) {
      setError(getEmailError());
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
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

      setRegistered(true);
    } catch (_err) {
      setError(
        "Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (registered) {
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
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <CheckCircle className="h-12 w-12 text-green-500" />
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Registrierung eingegangen
                  </h2>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Vielen Dank für Ihre Registrierung. Ihr Konto wird von einem
                    Administrator geprüft. Sie erhalten Zugang, sobald Ihre
                    Registrierung freigegeben wurde.
                  </p>
                  <p className="text-gray-500 text-sm">
                    Bitte prüfen Sie ggf. auch Ihr Postfach für eine
                    E-Mail-Bestätigung.
                  </p>
                </div>
                <Link
                  href="/auth/login"
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Zurück zur Anmeldung
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
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
            <CardTitle>Konto erstellen</CardTitle>
            <CardDescription>
              Registrieren Sie sich mit Ihrer geschäftlichen E-Mail-Adresse. Ihr
              Konto wird nach der Registrierung von einem Administrator
              freigegeben.
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
                <Label htmlFor="email">Geschäftliche E-Mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@unternehmen.de"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Kostenlose E-Mail-Anbieter (Gmail, Yahoo etc.) sind nicht
                  zulässig.
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
