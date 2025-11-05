import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">404 - Page Not Found</h1>
      <p className="mt-4 text-gray-600">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link
        href="/dashboard"
        className="mt-8 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Go to Dashboard
      </Link>
    </div>
  );
}
