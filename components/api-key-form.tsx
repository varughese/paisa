"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound, ArrowRight, Loader2, ExternalLink } from "lucide-react";

interface ApiKeyFormProps {
  onSubmit: (apiKey: string) => void;
  isLoading: boolean;
  error: string | null;
}

export function ApiKeyForm({ onSubmit, isLoading, error }: ApiKeyFormProps) {
  const [apiKey, setApiKey] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      onSubmit(apiKey.trim());
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
            <KeyRound className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Budget Dashboard
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Connect your Lunch Money account to compare your spending year over year.
          </p>
        </div>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Enter your API key</CardTitle>
            <CardDescription>
              Get your key from{" "}
              <a
                href="https://my.lunchmoney.app/developers"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4 hover:text-foreground/80"
              >
                Lunch Money
                <ExternalLink className="h-3 w-3" />
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                type="password"
                placeholder="Paste your Lunch Money API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="h-11 font-mono text-sm"
                autoFocus
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button
                type="submit"
                disabled={!apiKey.trim() || isLoading}
                className="h-11"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    Connect
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Your API key is stored locally in your browser and never sent to any server except Lunch Money.
        </p>
      </div>
    </div>
  );
}
