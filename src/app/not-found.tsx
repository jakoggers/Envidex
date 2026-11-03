import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16">
      <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-primary">
        Page not found
      </h1>
      <p className="mt-2 text-muted-foreground">
        <Link href="/" className="text-primary underline-offset-4 hover:underline">
          Back to Secondhand Scout
        </Link>
      </p>
    </div>
  );
}
