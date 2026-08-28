"use client";

import type { AuthSlide } from "@/components/auth/authSlides";

type AuthHeroIllustrationProps = {
  variant: AuthSlide["illustration"];
};

function DecorativeRings() {
  return (
    <>
      <circle cx="180" cy="118" r="108" fill="rgb(255 255 255 / 0.1)" />
      <circle cx="180" cy="118" r="78" fill="rgb(255 255 255 / 0.07)" />
      <circle cx="180" cy="118" r="52" fill="rgb(255 255 255 / 0.05)" />
    </>
  );
}

function IntegrationIllustration() {
  return (
    <svg viewBox="0 0 360 260" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <DecorativeRings />

      <rect x="208" y="62" width="118" height="132" rx="14" fill="#fff" fillOpacity="0.96" />
      <rect x="220" y="78" width="52" height="8" rx="4" fill="#E2E8F0" />
      <rect x="220" y="98" width="94" height="6" rx="3" fill="#F1F5F9" />
      <rect x="220" y="118" width="94" height="6" rx="3" fill="#F1F5F9" />
      <rect x="220" y="138" width="94" height="6" rx="3" fill="#F1F5F9" />
      <circle cx="228" cy="164" r="10" fill="#EEF2FF" />
      <rect x="244" y="159" width="70" height="5" rx="2.5" fill="#E2E8F0" />
      <rect x="244" y="168" width="48" height="4" rx="2" fill="#F1F5F9" />
      <circle cx="228" cy="186" r="10" fill="#ECFDF5" />
      <rect x="244" y="181" width="70" height="5" rx="2.5" fill="#E2E8F0" />
      <rect x="244" y="190" width="48" height="4" rx="2" fill="#F1F5F9" />

      <circle cx="88" cy="88" r="22" fill="#fff" fillOpacity="0.95" />
      <circle cx="88" cy="88" r="22" stroke="rgb(255 255 255 / 0.35)" strokeWidth="1.5" />
      <rect x="78" y="80" width="20" height="16" rx="4" fill="#FF7A59" />
      <rect x="82" y="84" width="12" height="3" rx="1.5" fill="#fff" />

      <circle cx="72" cy="142" r="22" fill="#fff" fillOpacity="0.95" />
      <circle cx="72" cy="142" r="22" stroke="rgb(255 255 255 / 0.35)" strokeWidth="1.5" />
      <path d="M64 142h16M72 134v16" stroke="#4F46E5" strokeWidth="2.5" strokeLinecap="round" />

      <circle cx="108" cy="178" r="22" fill="#fff" fillOpacity="0.95" />
      <circle cx="108" cy="178" r="22" stroke="rgb(255 255 255 / 0.35)" strokeWidth="1.5" />
      <path
        d="M98 178c0-5.5 4.5-10 10-10s10 4.5 10 10"
        stroke="#10B981"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path d="M108 168v20" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" />

      <path
        d="M110 96C138 96 156 88 176 78M94 142C128 132 168 118 208 108M130 178C158 162 188 142 208 128"
        stroke="rgb(255 255 255 / 0.55)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function VoiceIllustration() {
  return (
    <svg viewBox="0 0 360 260" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <DecorativeRings />

      <rect x="200" y="58" width="128" height="148" rx="16" fill="#fff" fillOpacity="0.96" />
      <rect x="216" y="74" width="56" height="8" rx="4" fill="#E2E8F0" />
      <rect x="216" y="94" width="96" height="38" rx="10" fill="#EEF2FF" />
      <path
        d="M228 113h8M240 113h8M252 113h8M264 113h8M276 113h8M288 113h6"
        stroke="#4F46E5"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <rect x="216" y="142" width="96" height="8" rx="4" fill="#ECFDF5" />
      <rect x="216" y="158" width="72" height="8" rx="4" fill="#F1F5F9" />
      <rect x="216" y="174" width="84" height="8" rx="4" fill="#F1F5F9" />
      <rect x="216" y="190" width="56" height="6" rx="3" fill="#4F46E5" fillOpacity="0.35" />

      <circle cx="92" cy="118" r="36" fill="#fff" fillOpacity="0.95" />
      <circle cx="92" cy="118" r="36" stroke="rgb(255 255 255 / 0.35)" strokeWidth="1.5" />
      <path d="M92 96v16" stroke="#4F46E5" strokeWidth="3" strokeLinecap="round" />
      <path d="M82 112h20" stroke="#4F46E5" strokeWidth="3" strokeLinecap="round" />
      <rect x="86" y="112" width="12" height="18" rx="6" fill="#4F46E5" fillOpacity="0.15" />
      <path
        d="M80 128c0 7 5.5 12 12 12s12-5 12-12"
        stroke="#10B981"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path d="M92 140v10" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M84 150h16" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" />

      <path
        d="M128 104C152 92 176 82 200 74M128 124C156 112 182 100 200 92"
        stroke="rgb(255 255 255 / 0.55)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CampaignIllustration() {
  return (
    <svg viewBox="0 0 360 260" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <DecorativeRings />

      <rect x="200" y="64" width="124" height="136" rx="14" fill="#fff" fillOpacity="0.96" />
      <rect x="214" y="80" width="56" height="8" rx="4" fill="#E2E8F0" />
      <rect x="214" y="102" width="36" height="28" rx="8" fill="#ECFDF5" />
      <rect x="256" y="102" width="36" height="28" rx="8" fill="#EEF2FF" />
      <rect x="298" y="102" width="12" height="28" rx="6" fill="#F1F5F9" />
      <rect x="214" y="140" width="96" height="6" rx="3" fill="#10B981" fillOpacity="0.35" />
      <rect x="214" y="140" width="68" height="6" rx="3" fill="#10B981" />
      <rect x="214" y="156" width="96" height="6" rx="3" fill="#4F46E5" fillOpacity="0.25" />
      <rect x="214" y="156" width="52" height="6" rx="3" fill="#4F46E5" />
      <rect x="214" y="176" width="96" height="6" rx="3" fill="#F1F5F9" />
      <rect x="214" y="192" width="72" height="6" rx="3" fill="#F1F5F9" />

      <circle cx="92" cy="96" r="20" fill="#fff" fillOpacity="0.95" />
      <path d="M84 96l6 6 12-12" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      <circle cx="76" cy="142" r="20" fill="#fff" fillOpacity="0.95" />
      <path d="M70 142h12M76 136v12" stroke="#4F46E5" strokeWidth="2.5" strokeLinecap="round" />

      <circle cx="108" cy="178" r="20" fill="#fff" fillOpacity="0.95" />
      <path d="M100 178h16M108 170v16" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round" />

      <path
        d="M112 92C140 88 168 78 200 72M104 142C140 128 172 116 200 108M124 178C156 162 184 148 200 138"
        stroke="rgb(255 255 255 / 0.55)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function AuthHeroIllustration({ variant }: AuthHeroIllustrationProps) {
  if (variant === "voice") return <VoiceIllustration />;
  if (variant === "campaigns") return <CampaignIllustration />;
  return <IntegrationIllustration />;
}
