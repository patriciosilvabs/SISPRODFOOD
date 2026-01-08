import { useState } from 'react';
import { Bell, Volume2, VolumeX } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useLembretesAudio } from '@/hooks/useLembretesAudio';

export function LembretesAudioPlayer() {
  const { lembreteAtivo, tocarAudio, pararAudio, dispensarLembrete } = useLembretesAudio();
  const [tocando, setTocando] = useState(false);

  const handleTocar = () => {
    if (tocando) {
      pararAudio();
      setTocando(false);
    } else {
      tocarAudio();
      setTocando(true);
    }
  };

  const handleDispensarEFechar = () => {
    setTocando(false);
    dispensarLembrete();
  };

  if (!lembreteAtivo) return null;

  const horaFormatada = lembreteAtivo.horario.substring(0, 5);

  return (
    <AlertDialog open={!!lembreteAtivo} onOpenChange={() => {}}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary animate-pulse" />
            Lembrete - {horaFormatada}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p className="text-lg font-medium text-foreground">
                {lembreteAtivo.titulo}
              </p>
              {lembreteAtivo.descricao && (
                <p className="text-muted-foreground">
                  {lembreteAtivo.descricao}
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-2 sm:justify-between">
          <Button
            variant="outline"
            onClick={handleTocar}
            className="flex items-center gap-2"
          >
            {tocando ? (
              <>
                <VolumeX className="h-4 w-4" />
                Parar
              </>
            ) : (
              <>
                <Volume2 className="h-4 w-4" />
                Ouvir Áudio
              </>
            )}
          </Button>
          <AlertDialogAction onClick={handleDispensarEFechar}>
            Dispensar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
