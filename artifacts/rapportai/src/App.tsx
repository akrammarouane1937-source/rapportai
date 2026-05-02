import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import LandingPage from "@/pages/LandingPage";
import OnboardingPage from "@/pages/OnboardingPage";
import DashboardPage from "@/pages/DashboardPage";
import RapportsPage from "@/pages/RapportsPage";
import DemoPage from "@/pages/DemoPage";
import PricingPage from "@/pages/PricingPage";
import Step1Page from "@/pages/Step1Page";
import Step4Page from "@/pages/Step4Page";
import Step5Page from "@/pages/Step5Page";
import Step6Page from "@/pages/Step6Page";
import Step9Page from "@/pages/Step9Page";
import Step2Page from "@/pages/Step2Page";
import Step3Page from "@/pages/Step3Page";
import PartieIPage from "@/pages/PartieIPage";
import PartieIIPage from "@/pages/PartieIIPage";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL as string | undefined;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsPlacement: "top" as const,
    socialButtonsVariant: "blockButton" as const,
  },
  variables: {
    colorPrimary: "#7c3aed",
    colorForeground: "#111827",
    colorMutedForeground: "#6b7280",
    colorDanger: "#ef4444",
    colorBackground: "#ffffff",
    colorInput: "#f9fafb",
    colorInputForeground: "#111827",
    colorNeutral: "#e5e7eb",
    fontFamily: "'DM Sans', sans-serif",
    borderRadius: "8px",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-none",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none px-2",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-gray-900 font-bold text-2xl",
    headerSubtitle: "text-gray-500 text-sm",
    socialButtonsBlockButtonText: "text-gray-700 font-medium",
    formFieldLabel: "text-gray-700 font-medium text-sm",
    footerActionLink: "text-purple-600 font-semibold hover:text-purple-700",
    footerActionText: "text-gray-500",
    dividerText: "text-gray-400 text-xs",
    identityPreviewEditButton: "text-purple-600",
    formFieldSuccessText: "text-green-600",
    alertText: "text-red-600",
    logoBox: "mb-2",
    logoImage: "h-10 w-auto",
    socialButtonsBlockButton: "border border-gray-200 hover:bg-gray-50 rounded-lg font-medium",
    formButtonPrimary: "bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-md",
    formFieldInput: "border border-gray-200 rounded-lg bg-gray-50 text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-purple-500",
    footerAction: "border-t border-gray-100 bg-gray-50",
    dividerLine: "bg-gray-200",
    alert: "border border-red-200 bg-red-50 rounded-lg",
    otpCodeFieldInput: "border border-gray-200 rounded-lg",
    formFieldRow: "gap-2",
    main: "gap-4",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 text-white"
        style={{ background: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)" }}>
        <div className="max-w-md text-center">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="text-white text-2xl font-bold">R</span>
            </div>
            <span className="text-3xl font-bold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              RapportAI
            </span>
          </div>
          <h2 className="text-3xl font-bold mb-4 leading-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Le premier outil IA pour les rapports académiques marocains
          </h2>
          <p className="text-purple-200 text-lg">
            3 mois de rédaction. 30 minutes avec RapportAI.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-4 text-center">
            <div className="bg-white/10 rounded-xl p-4">
              <div className="text-2xl font-bold">30 min</div>
              <div className="text-purple-200 text-xs mt-1">Génération</div>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <div className="text-2xl font-bold">80+</div>
              <div className="text-purple-200 text-xs mt-1">Écoles</div>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <div className="text-2xl font-bold">100%</div>
              <div className="text-purple-200 text-xs mt-1">Original</div>
            </div>
          </div>
        </div>
      </div>
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <SignIn
            routing="path"
            path={`${basePath}/sign-in`}
            signUpUrl={`${basePath}/sign-up`}
            forceRedirectUrl={`${basePath}/dashboard`}
          />
        </div>
      </div>
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 text-white"
        style={{ background: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)" }}>
        <div className="max-w-md text-center">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="text-white text-2xl font-bold">R</span>
            </div>
            <span className="text-3xl font-bold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              RapportAI
            </span>
          </div>
          <h2 className="text-3xl font-bold mb-4 leading-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Le premier outil IA pour les rapports académiques marocains
          </h2>
          <p className="text-purple-200 text-lg">
            3 mois de rédaction. 30 minutes avec RapportAI.
          </p>
          <div className="mt-10 space-y-3">
            <div className="flex items-center gap-3 bg-white/10 rounded-xl p-4 text-left">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</div>
              <div>
                <div className="font-semibold text-sm">Décris ton projet</div>
                <div className="text-purple-200 text-xs">Thème, école, filière — 2 minutes</div>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white/10 rounded-xl p-4 text-left">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</div>
              <div>
                <div className="font-semibold text-sm">L'IA génère ton rapport</div>
                <div className="text-purple-200 text-xs">Chaque section rédigée pour toi</div>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white/10 rounded-xl p-4 text-left">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</div>
              <div>
                <div className="font-semibold text-sm">Télécharge et soumets</div>
                <div className="text-purple-200 text-xs">Ton .docx prêt à imprimer</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <SignUp
            routing="path"
            path={`${basePath}/sign-up`}
            signInUrl={`${basePath}/sign-in`}
            forceRedirectUrl={`${basePath}/onboarding`}
          />
        </div>
      </div>
    </div>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <Component />
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Bon retour",
            subtitle: "Connecte-toi à ton compte RapportAI",
          },
        },
        signUp: {
          start: {
            title: "Crée ton compte",
            subtitle: "Génère ton rapport académique en 30 minutes",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route path="/onboarding">
              <ProtectedRoute component={OnboardingPage} />
            </Route>
            <Route path="/dashboard">
              <ProtectedRoute component={DashboardPage} />
            </Route>
            <Route path="/rapports">
              <ProtectedRoute component={RapportsPage} />
            </Route>
            <Route path="/demo" component={DemoPage} />
            <Route path="/pricing" component={PricingPage} />
            <Route path="/rapport/step-1">
              <ProtectedRoute component={Step1Page} />
            </Route>
            <Route path="/rapport/step-2">
              <ProtectedRoute component={Step2Page} />
            </Route>
            <Route path="/rapport/step-3">
              <ProtectedRoute component={Step3Page} />
            </Route>
            <Route path="/rapport/step-4">
              <ProtectedRoute component={Step4Page} />
            </Route>
            <Route path="/rapport/step-5">
              <ProtectedRoute component={Step5Page} />
            </Route>
            <Route path="/rapport/step-6">
              <ProtectedRoute component={Step6Page} />
            </Route>
            <Route path="/rapport/step-9">
              <ProtectedRoute component={Step9Page} />
            </Route>
            <Route path="/rapport/partie-i">
              <ProtectedRoute component={PartieIPage} />
            </Route>
            <Route path="/rapport/partie-ii">
              <ProtectedRoute component={PartieIIPage} />
            </Route>
            <Route path="/demo/step-1" component={Step1Page} />
            <Route path="/demo/step-2" component={Step2Page} />
            <Route path="/demo/step-3" component={Step3Page} />
            <Route path="/demo/step-4" component={Step4Page} />
            <Route path="/demo/step-5" component={Step5Page} />
            <Route path="/demo/step-6" component={Step6Page} />
            <Route path="/demo/step-9" component={Step9Page} />
            <Route path="/demo/partie-i" component={PartieIPage} />
            <Route path="/demo/partie-ii" component={PartieIIPage} />
            <Route component={NotFound} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
