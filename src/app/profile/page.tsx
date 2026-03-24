"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "../../lib/supabase/client";
import { AppHeader } from "../../components/layout/AppHeader";
import { HeaderActions } from "../../components/layout/HeaderActions";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Alert, AlertDescription } from "../../components/ui/alert";
import {
  Loader2,
  Mail,
  User as UserIcon,
  Lock,
  Camera,
  Bell,
  BellOff,
} from "lucide-react";
import { t } from "../../lib/i18n";
import {
  usePreferencesStore,
  requestDesktopPermission,
} from "../../store/preferences";

const schema = z.object({
  name: z
    .string()
    .min(1, t("profile.nameRequired"))
    .max(255, t("profile.nameTooLong")),
});

type FormValues = z.infer<typeof schema>;

const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").trim();
const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
).replace(/\/$/, "");

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notification preferences
  const dndMode = usePreferencesStore((s) => s.dndMode);
  const desktopNotificationsEnabled = usePreferencesStore(
    (s) => s.desktopNotificationsEnabled,
  );
  const setDndMode = usePreferencesStore((s) => s.setDndMode);
  const setDesktopNotificationsEnabled = usePreferencesStore(
    (s) => s.setDesktopNotificationsEnabled,
  );
  const [desktopPermission, setDesktopPermission] = useState<
    "granted" | "denied" | "default" | "unsupported"
  >("default");

  // Read current browser permission on mount
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setDesktopPermission("unsupported");
    } else {
      setDesktopPermission(
        Notification.permission as "granted" | "denied" | "default",
      );
    }
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push("/auth/login");
        return;
      }
      const user = session.user;
      setEmail(user.email || "");
      setUserId(user.id);
      setAvatarUrl(
        (user.user_metadata?.avatar_url as string | undefined) ?? null,
      );

      const { data: profile } = await supabase
        .from("users")
        .select("name")
        .eq("id", user.id)
        .single();

      reset({ name: profile?.name ?? user.user_metadata?.name ?? "" });
      setIsLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, supabase.auth]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      setError(t("profile.invalidImageType"));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError(t("profile.imageTooLarge"));
      return;
    }

    setAvatarUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const ext = file.name.split(".").pop();
      const path = `${userId}/avatar.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: signedData, error: signErr } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year
      if (signErr) throw signErr;

      const { error: metaErr } = await supabase.auth.updateUser({
        data: { avatar_url: signedData.signedUrl, avatar_path: path },
      });
      if (metaErr) throw metaErr;

      // Also persist to the users table so board member queries include it
      await supabase
        .from("users")
        .update({ avatar_url: signedData.signedUrl })
        .eq("id", userId);

      setAvatarUrl(signedData.signedUrl);
      setSuccess(t("profile.avatarUpdated"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("profile.failedToUpload"));
    } finally {
      setAvatarUploading(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: values.name }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || t("profile.failedToUpdate"));
      }
      setSuccess(t("profile.profileUpdated"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("profile.failedToUpdate"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleDesktopNotifications = async (enable: boolean) => {
    if (!enable) {
      setDesktopNotificationsEnabled(false);
      return;
    }
    if (desktopPermission === "unsupported") return;
    if (desktopPermission === "denied") return;
    const granted = await requestDesktopPermission();
    setDesktopPermission(granted ? "granted" : "denied");
    if (granted) setDesktopNotificationsEnabled(true);
  };

  const handleResetPassword = async () => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user || !user.email) throw new Error(t("profile.notAuthenticated"));

      const redirectTo = `${siteUrl}${basePath || ""}/auth/reset-password`;
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
        user.email,
        { redirectTo },
      );
      if (resetErr) throw resetErr;
      setSuccess(t("profile.passwordResetSent"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("profile.failedToSendReset"));
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">{t("profile.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title={t("profile.title")}
        subtitle={t("profile.subtitle")}
        navActions={<HeaderActions />}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-6">
          {/* Profile card */}
          <Card>
            <CardHeader>
              <CardTitle>{t("profile.cardTitle")}</CardTitle>
              <CardDescription>{t("profile.cardDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Avatar */}
              <div className="flex items-center gap-6 mb-6">
                <div className="relative">
                  <div className="h-20 w-20 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center ring-2 ring-gray-100">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarUrl}
                        alt="Avatar"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserIcon className="h-10 w-10 text-gray-400" />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="absolute -bottom-1 -right-1 rounded-full bg-white border border-gray-200 p-1.5 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                  >
                    {avatarUploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-600" />
                    ) : (
                      <Camera className="h-3.5 w-3.5 text-gray-600" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {t("profile.profilePhoto")}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t("profile.photoFormats")}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
                <div className="space-y-2">
                  <Label htmlFor="email">{t("profile.emailLabel")}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      value={email}
                      disabled
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">{t("profile.nameLabel")}</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="name"
                      placeholder={t("profile.namePlaceholder")}
                      className="pl-10"
                      {...register("name")}
                    />
                  </div>
                  {errors.name && (
                    <p className="text-sm text-red-600">
                      {errors.name.message}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    disabled={submitting}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("profile.saving")}
                      </>
                    ) : (
                      t("profile.saveChanges")
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Security card */}
          <Card>
            <CardHeader>
              <CardTitle>{t("profile.securityTitle")}</CardTitle>
              <CardDescription>
                {t("profile.securityDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <p>{t("profile.sendResetEmail")}</p>
                  <p className="text-xs">{t("profile.resetRedirectInfo")}</p>
                </div>
                <Button onClick={handleResetPassword} disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("profile.sending")}
                    </>
                  ) : (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      {t("profile.resetPassword")}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Notification settings card */}
          <Card>
            <CardHeader>
              <CardTitle>{t("notificationSettings.title")}</CardTitle>
              <CardDescription>
                {t("notificationSettings.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* DnD toggle */}
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {dndMode ? (
                      <BellOff className="h-4 w-4 text-amber-500" />
                    ) : (
                      <Bell className="h-4 w-4 text-gray-500" />
                    )}
                    <p className="text-sm font-medium text-gray-900">
                      {t("notificationSettings.dndMode")}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500">
                    {t("notificationSettings.dndModeDescription")}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={dndMode}
                  onClick={() => setDndMode(!dndMode)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                    dndMode ? "bg-amber-500" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                      dndMode ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Desktop notifications toggle */}
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-gray-500" />
                    <p className="text-sm font-medium text-gray-900">
                      {t("notificationSettings.desktopNotifications")}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500">
                    {t("notificationSettings.desktopNotificationsDescription")}
                  </p>
                  {desktopPermission === "denied" && (
                    <p className="text-xs text-red-500">
                      {t("notificationSettings.desktopNotificationsDenied")}
                    </p>
                  )}
                  {desktopPermission === "unsupported" && (
                    <p className="text-xs text-gray-400">
                      {t(
                        "notificationSettings.desktopNotificationsUnsupported",
                      )}
                    </p>
                  )}
                  {desktopPermission === "granted" &&
                    desktopNotificationsEnabled && (
                      <p className="text-xs text-green-600">
                        {t("notificationSettings.desktopNotificationsGranted")}
                      </p>
                    )}
                </div>
                {desktopPermission === "unsupported" ||
                desktopPermission === "denied" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled
                    onClick={() => void handleToggleDesktopNotifications(true)}
                  >
                    {t("notificationSettings.desktopNotificationsRequest")}
                  </Button>
                ) : (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={desktopNotificationsEnabled}
                    onClick={() =>
                      void handleToggleDesktopNotifications(
                        !desktopNotificationsEnabled,
                      )
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                      desktopNotificationsEnabled
                        ? "bg-blue-600"
                        : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                        desktopNotificationsEnabled
                          ? "translate-x-5"
                          : "translate-x-0"
                      }`}
                    />
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
