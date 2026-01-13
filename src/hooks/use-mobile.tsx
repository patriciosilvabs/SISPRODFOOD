import * as React from "react";

const MOBILE_BREAKPOINT = 768;

// Detecta se é realmente um dispositivo móvel de forma robusta
function detectMobileDevice(): boolean {
  // 1. Verificar User-Agent para padrões de dispositivos móveis
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i;
  const isMobileUserAgent = mobileRegex.test(userAgent);

  // 2. Verificar se tem touch como recurso principal
  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // 3. Verificar dimensões físicas da tela (não muda com modo desktop)
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  const smallerDimension = Math.min(screenWidth, screenHeight);
  const isSmallScreen = smallerDimension < MOBILE_BREAKPOINT;

  // 4. Verificar se a plataforma é mobile
  const mobilePlatforms = /iPhone|iPad|iPod|Android/i;
  const isMobilePlatform = mobilePlatforms.test(navigator.platform) || 
                           mobilePlatforms.test(navigator.userAgent);

  // Considera mobile se:
  // - User-Agent indica mobile E tem touch screen
  // - OU dimensões físicas da tela são pequenas E tem touch
  // - OU é explicitamente uma plataforma mobile
  return (isMobileUserAgent && hasTouchScreen) || 
         (isSmallScreen && hasTouchScreen) || 
         isMobilePlatform;
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const checkMobile = () => {
      const isDeviceMobile = detectMobileDevice();
      const isViewportSmall = window.innerWidth < MOBILE_BREAKPOINT;
      
      // É mobile se o dispositivo for mobile OU se a viewport for pequena
      setIsMobile(isDeviceMobile || isViewportSmall);
    };

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    mql.addEventListener("change", checkMobile);
    
    checkMobile();
    
    return () => mql.removeEventListener("change", checkMobile);
  }, []);

  return !!isMobile;
}
