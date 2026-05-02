import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

const PALETTE = [
  "rgba(124,58,237,0.85)",
  "rgba(99,102,241,0.85)",
  "rgba(59,130,246,0.85)",
  "rgba(16,185,129,0.85)",
  "rgba(245,158,11,0.85)",
  "rgba(239,68,68,0.85)",
  "rgba(236,72,153,0.85)",
];
const BORDERS = PALETTE.map((c) => c.replace("0.85", "1"));

export interface ChartDataset {
  label: string;
  data: number[];
}

export async function renderChartToPng(
  type: "bar" | "line" | "pie" | "doughnut",
  labels: string[],
  datasets: ChartDataset[],
  title: string,
): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 450;
    canvas.style.cssText = "position:absolute;left:-9999px;top:-9999px;";
    document.body.appendChild(canvas);

    const isPolar = type === "pie" || type === "doughnut";

    const chart = new Chart(canvas, {
      type,
      data: {
        labels,
        datasets: datasets.map((d, i) => ({
          label: d.label,
          data: d.data,
          backgroundColor: isPolar
            ? PALETTE.slice(0, d.data.length)
            : PALETTE[i % PALETTE.length],
          borderColor: isPolar
            ? BORDERS.slice(0, d.data.length)
            : BORDERS[i % BORDERS.length],
          borderWidth: 2,
          fill: type === "line" ? false : undefined,
          tension: 0.4,
          pointRadius: type === "line" ? 4 : undefined,
        })),
      },
      options: {
        animation: false as never,
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: title,
            font: { size: 14, weight: "bold" },
            padding: { bottom: 16 },
          },
          legend: { display: datasets.length > 1 || isPolar },
        },
        scales: isPolar
          ? {}
          : {
              y: {
                beginAtZero: false,
                grid: { color: "rgba(0,0,0,0.06)" },
                ticks: { font: { size: 11 } },
              },
              x: {
                grid: { display: false },
                ticks: { font: { size: 11 } },
              },
            },
        layout: { padding: 16 },
      },
    });

    // Animation disabled — short delay for paint cycle
    setTimeout(() => {
      const png = canvas.toDataURL("image/png");
      chart.destroy();
      document.body.removeChild(canvas);
      resolve(png);
    }, 200);
  });
}

/** Fallback chart with auto-generated sample data when no file is uploaded */
export async function renderFallbackChart(
  type: "bar" | "line" | "pie" | "doughnut",
  title: string,
): Promise<string> {
  const SAMPLE_LABELS = ["2020", "2021", "2022", "2023", "2024"];
  const SAMPLE_DATA   = [42, 58, 63, 71, 85];
  return renderChartToPng(type, SAMPLE_LABELS, [{ label: "Données", data: SAMPLE_DATA }], title);
}
