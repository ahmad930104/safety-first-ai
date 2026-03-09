import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a PPE (Personal Protective Equipment) safety detection AI. Analyze images of workers and detect if they are wearing required safety gear.

Required safety gear includes: hard hat/helmet, safety vest/high-visibility vest, safety gloves, safety goggles/glasses, safety boots/shoes.

You MUST respond using the suggest_violations tool.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this image for PPE compliance. For each person visible, determine if they are wearing all required safety gear (helmet, vest, gloves, goggles, boots). Report any missing gear."
              },
              {
                type: "image_url",
                image_url: { url: image }
              }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_violations",
              description: "Report PPE violations detected in the image",
              parameters: {
                type: "object",
                properties: {
                  people_detected: { type: "number", description: "Number of people detected in image" },
                  violations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        person_description: { type: "string", description: "Brief description of the person (e.g. 'person in blue shirt on the left')" },
                        missing_gear: {
                          type: "array",
                          items: { type: "string", enum: ["helmet", "vest", "gloves", "goggles", "boots"] }
                        },
                        severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
                        position: {
                          type: "object",
                          properties: {
                            x_percent: { type: "number", description: "Approximate X position of person as percentage (0-100) from left" },
                            y_percent: { type: "number", description: "Approximate Y position of person as percentage (0-100) from top" }
                          },
                          required: ["x_percent", "y_percent"]
                        }
                      },
                      required: ["person_description", "missing_gear", "severity", "position"]
                    }
                  },
                  all_compliant: { type: "boolean", description: "True if everyone is wearing all required PPE" },
                  summary: { type: "string", description: "Brief summary of the safety status" }
                },
                required: ["people_detected", "violations", "all_compliant", "summary"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "suggest_violations" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI detection failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ 
      people_detected: 0, violations: [], all_compliant: true, 
      summary: "No people detected in frame" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("detect-ppe error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
