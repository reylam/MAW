import { useEffect, useMemo, useState } from "react";
import { mockAlerts, mockCrossings } from "../lib/mockData";
import { useSimulationStore } from "../store/simulationStore";
import { crossingService } from "../services/crossingService.js";
import { alertService } from "../services/alertService.js";
import { eventService } from "../services/eventService.js";
import { deviceService } from "../services/deviceService.js";
import { AlertTriangle, ShieldCheck, OctagonAlert, Train, Radio, ArrowUpRight, Clock3, MapPin, Activity } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardHeader } from "../components/ui/Card";
import StatGrid from "../components/ui/StatGrid";
import StatusBadge, { getStatusMeta } from "../components/ui/StatusBadge";
import SimulationBanner from "../components/ui/SimulationBanner";
import { EmptyState } from "../components/ui/States";

export default function Dashboard() {
  const { crossingStatuses } = useSimulationStore();
  const [crossings, setCrossings] = useState(mockCrossings);
  const [alerts, setAlerts] = useState(mockAlerts);
  const [events, setEvents] = useState([]);
  const [deviceHealth, setDeviceHealth] = useState(null);

  useEffect(() => {
    crossingService.getAll().then((res) => setCrossings(res.data || mockCrossings)).catch(() => setCrossings(mockCrossings));
    alertService.getAll({ status: 'active' }).then((res) => setAlerts(res.data || mockAlerts)).catch(() => setAlerts(mockAlerts));
    eventService.getAll({ limit: 6 }).then((res) => setEvents(res.data || [])).catch(() => setEvents([]));
    deviceService.health().then((res) => setDeviceHealth(res.data || null)).catch(() => setDeviceHealth(null));
  }, []);

  const handleAcknowledge = async (id) => {
    try {
      await alertService.acknowledge(id);
      setAlerts(alerts.map(a => a.id === id ? { ...a, status: 'acknowledged' } : a));
    } catch (err) { console.error("Failed to acknowledge alert", err); }
  };

  const liveCrossings = useMemo(
    () => crossings.map((c) => ({ ...c, status: crossingStatuses[c.id] || c.status })),
    [crossings, crossingStatuses]
  );

  const criticalCount = liveCrossings.filter((c) => c.status === "critical").length;
  const warningCount = liveCrossings.filter((c) => c.status === "warning").length;
  const safeCount = liveCrossings.filter((c) => c.status === "safe").length;
  const offlineCount = liveCrossings.filter((c) => c.status === "offline").length;
  const trainCount = liveCrossings.filter((c) => c.trainDetected).length;

  const systemStatus = criticalCount > 0 ? "critical" : warningCount > 0 ? "warning" : "safe";
  const activeAlerts = alerts.filter((a) => !a.resolved && a.status !== "resolved");
  const priorityAlerts = activeAlerts
    .slice()
    .sort((a, b) => (a.type === "critical" ? -1 : 1) - (b.type === "critical" ? -1 : 1))
    .slice(0, 4);

  const eventStatus = (ev) => {
    if (ev.severity === "critical") return "critical";
    if (ev.severity === "warning" || /gate|override/.test(ev.event_type || "")) return "warning";
    return "safe";
  };

  const banner = {
    critical: {
      icon: OctagonAlert,
      title: "Immediate attention required",
      sub: `${criticalCount} crossing${criticalCount > 1 ? "s" : ""} in critical state${trainCount ? ` · ${trainCount} train${trainCount > 1 ? "s" : ""} detected` : ""}.`,
    },
    warning: {
      icon: AlertTriangle,
      title: "Monitoring with active warnings",
      sub: `${warningCount} crossing${warningCount > 1 ? "s" : ""} reporting abnormal conditions.`,
    },
    safe: {
      icon: ShieldCheck,
      title: "All crossings operating normally",
      sub: "No active safety warnings across the network.",
    },
  }[systemStatus];

  const BannerIcon = banner.icon;
  const bannerMeta = getStatusMeta(systemStatus);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-[1500px] mx-auto">
      <SimulationBanner />

      {/* Q1: Is the network currently safe? — the single dominant answer. */}
      <section className={`rounded-maw border ${bannerMeta.border} ${bannerMeta.soft} p-4 sm:p-5`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`mt-0.5 flex items-center justify-center h-10 w-10 rounded-maw-sm bg-maw-surface border ${bannerMeta.border} ${bannerMeta.fg} ${systemStatus === "critical" ? "animate-maw-alert" : ""}`}>
              <BannerIcon size={20} />
            </div>
            <div className="min-w-0">
              <div className="eyebrow">Network status</div>
              <h2 className={`mt-0.5 text-lg sm:text-xl font-display font-bold ${bannerMeta.fg}`}>{banner.title}</h2>
              <p className="mt-0.5 text-sm text-maw-text-muted">{banner.sub}</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-maw-text-subtle shrink-0">
            <Clock3 size={13} /> Updated just now
          </div>
        </div>
      </section>

      {/* Q2–Q5 at a glance: counts across the network. */}
      <Card className="overflow-hidden">
        <StatGrid
          cols={5}
          items={[
            { label: "Crossings", value: liveCrossings.length },
            { label: "Trains detected", value: trainCount, tone: trainCount ? "critical" : "muted" },
            { label: "Critical", value: criticalCount, tone: criticalCount ? "critical" : "muted" },
            { label: "Warnings", value: warningCount, tone: warningCount ? "warning" : "muted" },
            { label: "Safe", value: safeCount, suffix: `/ ${liveCrossings.length}`, tone: "safe" },
          ]}
        />
      </Card>

      <div className="grid xl:grid-cols-[1.5fr_1fr] gap-5">
        {/* Q3 + Q7: current status per crossing. */}
        <Card>
          <CardHeader
            eyebrow="Field overview"
            title="Crossing status"
            icon={Radio}
            action={
              <Link to="/crossings" className="inline-flex items-center gap-1 text-xs font-semibold text-maw-primary hover:text-maw-primary-hover">
                All crossings <ArrowUpRight size={13} />
              </Link>
            }
          />
          <div className="divide-y divide-maw-border-subtle">
            {liveCrossings.map((crossing) => (
              <Link
                to={`/crossing/${crossing.id}`}
                key={crossing.id}
                className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-maw-hover transition-colors"
              >
                <span className={`status-dot ${getStatusMeta(crossing.status).dot} ${crossing.status === "critical" ? "animate-maw-alert" : ""}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-maw-text-main truncate">{crossing.name}</div>
                  <div className="text-xs text-maw-text-subtle truncate flex items-center gap-1">
                    <MapPin size={11} /> {crossing.location || crossing.location_name}
                  </div>
                </div>
                {crossing.trainDetected && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-maw-critical">
                    <Train size={12} /> TRAIN
                  </span>
                )}
                <span className="hidden md:block text-[11px] font-mono text-maw-text-subtle uppercase w-24 text-right">
                  {String(crossing.barrierStatus || "—")} barrier
                </span>
                <StatusBadge status={crossing.status} />
                <ArrowUpRight size={14} className="text-maw-text-subtle shrink-0" />
              </Link>
            ))}
          </div>
        </Card>

        {/* Q6: what happened / needs action. */}
        <Card>
          <CardHeader
            eyebrow="Needs attention"
            title="Priority alerts"
            icon={AlertTriangle}
            action={
              <Link to="/alerts" className="text-xs font-semibold text-maw-primary hover:text-maw-primary-hover">
                View all
              </Link>
            }
          />
          {priorityAlerts.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="No active alerts" description="The network is clear. New alerts will appear here." />
          ) : (
            <div className="divide-y divide-maw-border-subtle">
              {priorityAlerts.map((alert) => {
                const sev = alert.type === "critical" || alert.severity === "critical" ? "critical" : "warning";
                const meta = getStatusMeta(sev);
                return (
                  <div key={alert.id} className="flex gap-3 px-4 sm:px-5 py-3">
                    <span className={`mt-1.5 status-dot ${meta.dot} ${sev === "critical" ? "animate-maw-alert" : ""}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-mono font-bold uppercase ${meta.fg}`}>{sev}</span>
                        <span className="text-[10px] text-maw-text-subtle font-mono">
                          {new Date(alert.triggered_at || alert.timestamp).toLocaleTimeString("id-ID")}
                        </span>
                      </div>
                      <div className="mt-0.5 text-sm font-semibold text-maw-text-main truncate">{alert.title}</div>
                      <div className="text-xs text-maw-text-muted line-clamp-2">{alert.message || alert.description}</div>
                      {alert.status !== "acknowledged" && (
                        <button
                          onClick={() => handleAcknowledge(alert.id)}
                          className="mt-1.5 text-[11px] font-semibold text-maw-primary hover:text-maw-primary-hover"
                        >
                          Acknowledge
                        </button>
                      )}
                      {alert.status === "acknowledged" && (
                        <span className="mt-1.5 inline-block text-[11px] text-maw-text-subtle">Acknowledged</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Q4 + Q6: sensor/device health and recent operational activity. */}
      <div className="grid xl:grid-cols-[1fr_1.3fr] gap-5">
        <Card>
          <CardHeader
            eyebrow="Network health"
            title="Devices & sensors"
            icon={Activity}
            action={
              <Link to="/health" className="text-xs font-semibold text-maw-primary hover:text-maw-primary-hover">
                Details
              </Link>
            }
          />
          <div className="p-4 sm:p-5 space-y-3">
            {(() => {
              const total = deviceHealth?.total_devices ?? liveCrossings.length;
              const online = deviceHealth?.online ?? liveCrossings.filter((c) => c.connectivity !== "disconnected" && c.status !== "offline").length;
              const allOnline = online >= total;
              const rows = [
                {
                  label: "Field devices",
                  value: `${online}/${total} online`,
                  status: allOnline ? "safe" : online === 0 ? "critical" : "warning",
                },
                {
                  label: "Avg. signal (RSSI)",
                  value: deviceHealth?.average_rssi != null ? `${Math.round(deviceHealth.average_rssi)} dBm` : "—",
                  status: "safe",
                },
                {
                  label: "Avg. battery",
                  value: deviceHealth?.average_battery != null ? `${Math.round(deviceHealth.average_battery)}%` : "—",
                  status: (deviceHealth?.average_battery ?? 100) < 25 ? "warning" : "safe",
                },
              ];
              return rows.map((r) => {
                const meta = getStatusMeta(r.status);
                return (
                  <div key={r.label} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm text-maw-text-muted">
                      <span className={`status-dot ${meta.dot}`} /> {r.label}
                    </span>
                    <span className="font-mono text-sm font-semibold text-maw-text-main">{r.value}</span>
                  </div>
                );
              });
            })()}
          </div>
        </Card>

        <Card>
          <CardHeader
            eyebrow="Audit trail"
            title="Recent activity"
            icon={Clock3}
            action={
              <Link to="/events" className="text-xs font-semibold text-maw-primary hover:text-maw-primary-hover">
                Full history
              </Link>
            }
          />
          {events.length === 0 ? (
            <EmptyState icon={Clock3} title="No recent events" description="System and operator activity will appear here." />
          ) : (
            <div className="divide-y divide-maw-border-subtle">
              {events.map((ev) => {
                const meta = getStatusMeta(eventStatus(ev));
                return (
                  <div key={ev.id} className="flex items-start gap-3 px-4 sm:px-5 py-2.5">
                    <span className={`mt-1.5 status-dot ${meta.dot} ${eventStatus(ev) === "critical" ? "animate-maw-alert" : ""}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-maw-text-main truncate">{ev.title}</div>
                      <div className="text-xs text-maw-text-subtle truncate">{ev.description}</div>
                    </div>
                    <span className="text-[11px] font-mono text-maw-text-subtle shrink-0 mt-0.5">
                      {ev.occurred_at ? new Date(ev.occurred_at).toLocaleTimeString("id-ID") : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Q7: where — entry point to the map, presented as an operational panel (no decorative glow). */}
      <Card>
        <CardHeader
          eyebrow="Jakarta network"
          title="Live railway map"
          icon={MapPin}
          action={
            <Link to="/map" className="inline-flex items-center gap-1 text-xs font-semibold text-maw-primary hover:text-maw-primary-hover">
              Open full map <ArrowUpRight size={13} />
            </Link>
          }
        />
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-maw-text-muted">
            <span className="flex items-center gap-1.5"><span className="status-dot bg-maw-safe" /> {safeCount} safe</span>
            <span className="flex items-center gap-1.5"><span className="status-dot bg-maw-warning" /> {warningCount} warning</span>
            <span className="flex items-center gap-1.5"><span className="status-dot bg-maw-critical" /> {criticalCount} critical</span>
            <span className="flex items-center gap-1.5"><span className="status-dot bg-maw-offline" /> {offlineCount} offline</span>
            <span className="ml-auto font-mono text-maw-text-subtle">{liveCrossings.length} points monitored</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
