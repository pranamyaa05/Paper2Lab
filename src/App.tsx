import { useState } from "react";
import { Footer, Header } from "@/components/sections/Chrome";
import { Hero } from "@/components/sections/Hero";
import { LabPicker } from "@/components/sections/LabPicker";
import { UnderTheHood } from "@/components/sections/UnderTheHood";
import { StorySection } from "@/components/story/StorySection";
import { Studio, type StudioRequest } from "@/components/studio/Studio";

/**
 * Page order is built around what a student came to do:
 * upload (hero) → their lab opens right below → explore ready-made labs → see how it works → details.
 */
export default function App() {
  const [request, setRequest] = useState<StudioRequest | null>(null);
  return (
    <>
      <a href="#top" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2">
        Skip to upload
      </a>
      <Header />
      <main>
        <Hero onImage={(img) => setRequest({ kind: "image", ...img, nonce: Date.now() })} onSample={(sampleId) => setRequest({ kind: "sample", sampleId, nonce: Date.now() })} />
        <Studio request={request} onClose={() => setRequest(null)} />
        <LabPicker onPick={(sampleId) => setRequest({ kind: "sample", sampleId, nonce: Date.now() })} />
        <StorySection />
        <UnderTheHood />
      </main>
      <Footer />
    </>
  );
}
