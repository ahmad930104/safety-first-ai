import { useState, useCallback, useRef, useEffect } from "react";
import { Camera, CameraOff, Scan, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCamera } from "@/hooks/useCamera";
import { useAlarm } from "@/hooks/useAlarm";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Violation {
  person_description: string;
  missing_gear: string[];
  severity: string;
  position: { x_percent: number; y_percent: number };
}

interface DetectionResult {
  people_detected: number;
  violations: Violation[];
  all_compliant: boolean;
  summary: string;
}

export default function Monitor() {
  const { videoRef, canvasRef, isStreaming, error, startCamera, stopCamera, captureFrame } = useCamera();
  const { playAlarm } = useAlarm();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [violations, setViolations] = useState<Violation[]>([]);
  const autoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const analyzeFrame = useCallback(async () => {
    const frame = captureFrame();
    if (!frame) {
      toast.error("Camera not ready yet — please wait a moment.");
      return;
    }

    setIsAnalyzing(true);
    try {
      console.log("[Monitor] Sending frame, size:", Math.round(frame.length / 1024), "KB");
      const { data, error: fnError } = await supabase.functions.invoke("detect-ppe", {
        body: { image: frame },
      });

      if (fnError) {
        console.error("[Monitor] Function error:", fnError);
        throw new Error(fnError.message || "Edge function error");
      }
      if (data?.error) throw new Error(data.error);

      const detection = data as DetectionResult;
      setResult(detection);
      setViolations(detection.violations);

      if (!detection.all_compliant && detection.violations.length > 0) {
        playAlarm();

        // Save violation photo and record
        for (const v of detection.violations) {
          try {
            const blob = await (await fetch(frame)).blob();
            const fileName = `violation-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
            const { error: uploadError } = await supabase.storage
              .from("violation-photos")
              .upload(fileName, blob, { contentType: "image/jpeg" });

            if (uploadError) {
              console.error("Upload error:", uploadError);
              continue;
            }

            const { data: urlData } = supabase.storage
              .from("violation-photos")
              .getPublicUrl(fileName);

            await supabase.from("violations").insert({
              employee_description: v.person_description,
              missing_gear: v.missing_gear,
              photo_url: urlData.publicUrl,
              severity: v.severity,
            });
          } catch (saveErr) {
            console.error("Save violation error:", saveErr);
          }
        }

        toast.error(`⚠️ ${detection.violations.length} PPE violation(s) detected!`, {
          description: detection.summary,
        });
      }
    } catch (err) {
      console.error("Analysis error:", err);
      const msg = err instanceof Error ? err.message : "Detection failed";
      toast.error(msg);
    } finally {
      setIsAnalyzing(false);
    }
  }, [captureFrame, playAlarm]);

  const toggleAutoMode = useCallback(() => {
    if (isAutoMode) {
      if (autoIntervalRef.current) clearInterval(autoIntervalRef.current);
      autoIntervalRef.current = null;
      setIsAutoMode(false);
    } else {
      setIsAutoMode(true);
      analyzeFrame();
      autoIntervalRef.current = setInterval(analyzeFrame, 10000); // every 10s
    }
  }, [isAutoMode, analyzeFrame]);

  useEffect(() => {
    return () => {
      if (autoIntervalRef.current) clearInterval(autoIntervalRef.current);
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Live Monitor</h1>
          <p className="text-muted-foreground">Real-time PPE compliance detection</p>
        </div>
        <div className="flex gap-2">
          {isStreaming ? (
            <>
              <Button onClick={analyzeFrame} disabled={isAnalyzing} variant="default">
                {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scan className="h-4 w-4" />}
                {isAnalyzing ? "Analyzing..." : "Scan Now"}
              </Button>
              <Button
                onClick={toggleAutoMode}
                variant={isAutoMode ? "destructive" : "outline"}
              >
                {isAutoMode ? "Stop Auto" : "Auto Scan"}
              </Button>
              <Button onClick={stopCamera} variant="outline">
                <CameraOff className="h-4 w-4" />
                Stop
              </Button>
            </>
          ) : (
            <Button onClick={startCamera} size="lg">
              <Camera className="h-4 w-4" />
              Start Camera
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Camera Feed */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="relative aspect-video bg-foreground/5">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                muted
                playsInline
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Red circle overlays for violations */}
              {violations.map((v, i) => (
                <div
                  key={i}
                  className="absolute animate-pulse-danger"
                  style={{
                    left: `${v.position.x_percent}%`,
                    top: `${v.position.y_percent}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <div className="h-24 w-24 rounded-full border-4 border-danger" />
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-danger px-2 py-1 text-xs font-bold text-danger-foreground">
                    {v.missing_gear.join(", ")}
                  </div>
                </div>
              ))}

              {/* Status overlay */}
              {!isStreaming && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <Camera className="h-16 w-16 text-muted-foreground/30" />
                  <p className="text-muted-foreground">Click "Start Camera" to begin monitoring</p>
                </div>
              )}

              {isAnalyzing && (
                <div className="absolute inset-0 flex items-center justify-center bg-foreground/10 backdrop-blur-sm">
                  <div className="flex items-center gap-3 rounded-lg bg-card px-6 py-4 shadow-lg">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="font-medium">Analyzing PPE compliance...</span>
                  </div>
                </div>
              )}

              {/* Live indicator */}
              {isStreaming && (
                <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-card/80 px-3 py-1 backdrop-blur-sm">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-danger" />
                  <span className="text-xs font-bold">LIVE</span>
                  {isAutoMode && <Badge variant="outline" className="text-xs">AUTO</Badge>}
                </div>
              )}
            </div>
          </Card>

          {error && (
            <div className="mt-4 rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
              {error}
            </div>
          )}
        </div>

        {/* Detection Results */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                {result?.all_compliant ? (
                  <CheckCircle className="h-5 w-5 text-safe" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-danger" />
                )}
                Detection Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-muted p-3 text-center">
                      <p className="text-2xl font-bold">{result.people_detected}</p>
                      <p className="text-xs text-muted-foreground">People Detected</p>
                    </div>
                    <div className="rounded-lg bg-muted p-3 text-center">
                      <p className="text-2xl font-bold text-danger">{result.violations.length}</p>
                      <p className="text-xs text-muted-foreground">Violations</p>
                    </div>
                  </div>

                  <div className={`rounded-lg p-3 text-sm font-medium ${result.all_compliant ? "bg-safe/10 text-safe" : "bg-danger/10 text-danger"}`}>
                    {result.summary}
                  </div>

                  {result.violations.map((v, i) => (
                    <div key={i} className="rounded-lg border border-danger/20 p-3">
                      <p className="text-sm font-semibold">{v.person_description}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {v.missing_gear.map((gear) => (
                          <Badge key={gear} variant="destructive" className="text-xs">
                            Missing: {gear}
                          </Badge>
                        ))}
                      </div>
                      <Badge variant="outline" className="mt-2 text-xs capitalize">
                        {v.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No scan performed yet. Start camera and click "Scan Now".
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
