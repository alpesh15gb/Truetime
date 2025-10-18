import { format, formatDistanceToNow, parseISO } from "date-fns";

export const formatDateTime = (value: string, pattern = "dd MMM yyyy, HH:mm") => {
  try {
    return format(parseISO(value), pattern);
  } catch (error) {
    return value;
  }
};

export const formatFullName = (firstName: string, lastName: string) => `${firstName} ${lastName}`.trim();

export const formatDirection = (direction: string) => {
  if (!direction) return "";
  const normalized = direction.toLowerCase();
  if (normalized === "in") return "Clock In";
  if (normalized === "out") return "Clock Out";
  return direction;
};

export const formatTime = (value: string, pattern = "HH:mm") => {
  try {
    return format(parseISO(`1970-01-01T${value}`), pattern);
  } catch (error) {
    return value;
  }
};

export const formatMinutes = (minutes?: number | null) => {
  if (minutes === undefined || minutes === null) return "—";
  const hours = Math.floor(minutes / 60);
  const remaining = Math.max(minutes - hours * 60, 0);
  if (hours === 0) {
    return `${remaining}m`;
  }
  if (remaining === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remaining}m`;
};

export const formatRelativeTime = (value?: string | null) => {
  if (!value) return "Never";
  try {
    return formatDistanceToNow(parseISO(value), { addSuffix: true });
  } catch (error) {
    return value;
  }
};
