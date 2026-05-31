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
function SectionsTermineesPage() { return <RapportsPage completedOnly />; }
import DemoPage from "@/pages/DemoPage";
import Step1Page from "@/pages/step-1";
import Step4Page from "@/pages/step-4";
import Step5Page from "@/pages/step-5";
import Step6Page from "@/pages/step-6";
import Step9Page from "@/pages/step-9";
import Step2Page from "@/pages/step-2";
import Step3Page from "@/pages/step-3";
import PartieIPage from "@/pages/partie-i";
import PartieIIPage from "@/pages/partie-ii";
import AnnexesPage from "@/pages/AnnexesPage";
import JuryAIPage from "@/pages/JuryAIPage";
import BibliothequeePage from "@/pages/BibliothequeePage";
import SharePage from "@/pages/SharePage";
import PaymentSuccessPage from "@/pages/PaymentSuccessPage";
import ParametresPage from "@/pages/ParametresPage";
import MiseEnFormePage from "@/pages/MiseEnFormePage";
import FiguresPage from "@/pages/FiguresPage";
import ListeFiguresPage from "@/pages/liste-figures";
import ListeTableauxPage from "@/pages/liste-tableaux";
import AboutPage from "@/pages/AboutPage";
import TonMomentPage from "@/pages/TonMomentPage";
import WhyRapportAIPage from "@/pages/WhyRapportAIPage";
import StoryPage from "@/pages/StoryPage";
import TermsPage from "@/pages/TermsPage";
import PrivacyPage from "@/pages/PrivacyPage";
import ReferralPage from "@/pages/ReferralPage";
import PricingPage from "@/pages/PricingPage";
import NotFound from "@/pages/not-found";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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
  console.warn("VITE_CLERK_PUBLISHABLE_KEY not set — auth features disabled");
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

function AuthRightPanel() {
  return (
    <div className="hidden lg:block lg:w-1/2 relative overflow-hidden">
      <img
        src="/auth-photo.jpg"
        alt="Étudiant en bibliothèque"
        className="absolute inset-0 w-full h-full object-cover object-center"
      />
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.38)" }} />
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-12">
        <p className="text-white text-2xl font-light mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Les grandes carrières naissent sur
        </p>
        <div className="flex items-center gap-3 bg-white/15 backdrop-blur-sm border border-white/25 rounded-2xl px-6 py-3">
          <img src="/logo.svg" alt="RapportAI" className="w-9 h-9" />
          <span className="text-white text-2xl font-extrabold tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            RapportAI
          </span>
        </div>
      </div>
    </div>
  );
}

function AuthFormWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full lg:w-1/2 flex flex-col min-h-screen bg-white">
      <div className="px-8 pt-6">
        <a href={basePath || "/"} className="inline-flex items-center gap-2 group">
          <img src="/logo.svg" alt="RapportAI" className="w-7 h-7" />
          <span className="font-bold text-gray-900 text-lg group-hover:text-purple-600 transition-colors" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            RapportAI
          </span>
        </a>
      </div>
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
}

function SignInPage() {
  return (
    <div className="flex min-h-screen">
      <AuthFormWrapper>
        <SignIn
          routing="path"
          path={`${basePath}/sign-in`}
          signUpUrl={`${basePath}/sign-up`}
          forceRedirectUrl={`${basePath}/dashboard`}
        />
      </AuthFormWrapper>
      <AuthRightPanel />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-screen">
      <AuthFormWrapper>
        <SignUp
          routing="path"
          path={`${basePath}/sign-up`}
          signInUrl={`${basePath}/sign-in`}
          forceRedirectUrl={`${basePath}/onboarding`}
        />
      </AuthFormWrapper>
      <AuthRightPanel />
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
            <Route path="/sections-terminees">
              <ProtectedRoute component={SectionsTermineesPage} />
            </Route>
            <Route path="/demo" component={DemoPage} />
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
            <Route path="/rapport/annexes">
              <ProtectedRoute component={AnnexesPage} />
            </Route>
            <Route path="/rapport/liste-figures">
              <ProtectedRoute component={ListeFiguresPage} />
            </Route>
            <Route path="/rapport/liste-tableaux">
              <ProtectedRoute component={ListeTableauxPage} />
            </Route>
            <Route path="/juryai">
              <ProtectedRoute component={JuryAIPage} />
            </Route>
            <Route path="/bibliotheque">
              <ProtectedRoute component={BibliothequeePage} />
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
          <Route path="/demo/annexes" component={AnnexesPage} />
            <Route path="/parametres">
              <ProtectedRoute component={ParametresPage} />
            </Route>
            <Route path="/mise-en-forme">
              <ProtectedRoute component={MiseEnFormePage} />
            </Route>
            <Route path="/figures">
              <ProtectedRoute component={FiguresPage} />
            </Route>
            <Route path="/share/:id" component={SharePage} />
            <Route path="/payment/success" component={PaymentSuccessPage} />
            <Route path="/about" component={AboutPage} />
            <Route path="/ton-moment" component={TonMomentPage} />
            <Route path="/why" component={WhyRapportAIPage} />
            <Route path="/story" component={StoryPage} />
            <Route path="/terms" component={TermsPage} />
            <Route path="/privacy" component={PrivacyPage} />
            <Route path="/pricing" component={PricingPage} />
            <Route component={NotFound} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function NoAuthApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Switch>
          <Route path="/" component={LandingPage} />
          <Route path="/sign-in/*?"><Redirect to="/onboarding" /></Route>
          <Route path="/sign-up/*?"><Redirect to="/onboarding" /></Route>
          <Route path="/onboarding" component={OnboardingPage} />
          <Route path="/dashboard" component={DashboardPage} />
          <Route path="/rapports">{() => <RapportsPage />}</Route>
          <Route path="/sections-terminees" component={SectionsTermineesPage} />
          <Route path="/demo" component={DemoPage} />
          <Route path="/rapport/step-1" component={Step1Page} />
          <Route path="/rapport/step-2" component={Step2Page} />
          <Route path="/rapport/step-3" component={Step3Page} />
          <Route path="/rapport/step-4" component={Step4Page} />
          <Route path="/rapport/step-5" component={Step5Page} />
          <Route path="/rapport/step-6" component={Step6Page} />
          <Route path="/rapport/step-9" component={Step9Page} />
          <Route path="/rapport/partie-i" component={PartieIPage} />
          <Route path="/rapport/partie-ii" component={PartieIIPage} />
          <Route path="/rapport/annexes" component={AnnexesPage} />
          <Route path="/rapport/liste-figures" component={ListeFiguresPage} />
          <Route path="/rapport/liste-tableaux" component={ListeTableauxPage} />
          <Route path="/juryai" component={JuryAIPage} />
          <Route path="/bibliotheque" component={BibliothequeePage} />
          <Route path="/parametres" component={ParametresPage} />
          <Route path="/mise-en-forme" component={MiseEnFormePage} />
          <Route path="/referral" component={ReferralPage} />
          <Route path="/figures" component={FiguresPage} />
          <Route path="/share/:id" component={SharePage} />
          <Route path="/payment/success" component={PaymentSuccessPage} />
          <Route path="/about" component={AboutPage} />
          <Route path="/ton-moment" component={TonMomentPage} />
          <Route path="/why" component={WhyRapportAIPage} />
          <Route path="/story" component={StoryPage} />
          <Route path="/terms" component={TermsPage} />
          <Route path="/privacy" component={PrivacyPage} />
          <Route path="/pricing" component={PricingPage} />
          <Route component={NotFound} />
        </Switch>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <WouterRouter base={basePath}>
        {clerkPubKey ? <ClerkProviderWithRoutes /> : <NoAuthApp />}
      </WouterRouter>
    </ErrorBoundary>
  );
}

export default App;
