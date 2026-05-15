export const OFFICE_HOURS = {
  OPEN: 7,
  CLOSE: 18,
  WORK_DAYS: [1, 2, 3, 4, 5] as const,
  IS_WORK_DAY: (d: number) => [1, 2, 3, 4, 5].includes(d),
  duracionSlot: 30,
} as const;

export const VEHICLE_OPTIONS = {
  TYPES: [
    "Sedán",
    "SUV",
    "Pickup",
    "Coupé",
    "Hatchback",
    "Van",
    "Carro",
    "Camioneta",
    "Moto",
    "Camión",
  ] as const,
  MOTORS: [
    "Combustión",
    "Híbrido",
    "Eléctrico",
    "V8 / High-Performance",
  ] as const,
  ERAS: [
    "Moderno (2015+)",
    "Intermedio (2000-2014)",
    "Clásico (90s / Retro)",
  ] as const,
} as const;

export const KILOMETRAJE_RANGES = [
  { label: "0 - 5.000 km", value: 2500 },
  { label: "5.000 - 10.000 km", value: 7500 },
  { label: "10.000 - 20.000 km", value: 15000 },
  { label: "20.000 - 50.000 km", value: 35000 },
  { label: "50.000 - 100.000 km", value: 75000 },
  { label: "100.000 - 150.000 km", value: 125000 },
  { label: "150.000 - 200.000 km", value: 175000 },
  { label: "+200.000 km", value: 200000 },
] as const;

export const SERVICE_OPTIONS = [
  "Diagnóstico",
  "Mantenimiento",
  "Reparación/Revisión",
  "Limpieza de Inyectores",
  "Escáner de Vehículo",
] as const;

export const SERVICE_DURATIONS: Record<string, number> = {
  Diagnóstico: 60,
  Mantenimiento: 120,
  "Reparación/Revisión": 90,
  "Limpieza de Inyectores": 90,
  "Escáner de Vehículo": 30,
};

export const BUFFER_LLEGADA_MINUTOS = 30;
