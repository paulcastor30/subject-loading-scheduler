import { useMemo, useState } from "react";
import { availableRooms, utilization } from "../lib/engine";
import type { Data } from "../lib/model";
import { Badge, DaySelect, Empty, Field, Panel, Reference } from "./UI";
import { Timetable } from "./Scheduling";
export function Rooms({ data, term }: { data: Data; term: string }) {
  const [day, setDay] = useState(0),
    [start, setStart] = useState("08:00"),
    [end, setEnd] = useState("09:00"),
    [size, setSize] = useState(30),
    [type, setType] = useState(""),
    [equipment, setEquipment] = useState(""),
    [room, setRoom] = useState("");
  const results = useMemo(
    () =>
      availableRooms(data, {
        semesterId: term,
        day,
        start,
        end,
        size,
        type,
        equipment,
      }),
    [data, term, day, start, end, size, type, equipment],
  );
  const stats = useMemo(
    () => new Map(data.rooms.map((r) => [r.id, utilization(data, r.id, term)])),
    [data, term],
  );
  const offeringIds = new Set(
    data.offerings.filter((o) => o.semesterId === term).map((o) => o.id),
  );
  return (
    <>
      <Panel
        title="Find an available room"
        action={<Badge tone="green">Live availability</Badge>}
      >
        <div className="padded">
          <p className="note">
            Results update as you type, ordered by the closest seating capacity.
            Blocked periods, equipment, and existing bookings are checked.
          </p>
          <div className="toolbar wrap">
            <DaySelect value={day} onChange={setDay} />
            <Field label="Start time">
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </Field>
            <Field label="End time">
              <input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </Field>
            <Field label="Class size">
              <input
                type="number"
                min="1"
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
              />
            </Field>
            <Field label="Room type">
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">Any type</option>
                <option value="classroom">Classroom</option>
                <option value="laboratory">Laboratory</option>
              </select>
            </Field>
            <Field label="Required equipment">
              <input
                placeholder="e.g. Computers,Projector"
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
              />
            </Field>
          </div>
          {start >= end || !start || !end || size < 1 ? (
            <div className="alert error">
              Enter a valid start/end time and a class size of at least one.
            </div>
          ) : (
            <div className="room-results">
              {results.map((r) => (
                <button
                  className={`room-card ${room === r.id ? "selected" : ""}`}
                  key={r.id}
                  onClick={() => setRoom(r.id)}
                >
                  <span className="room-code">{r.code}</span>
                  <Badge tone="green">Available</Badge>
                  <h3>{r.name}</h3>
                  <p>{r.building}</p>
                  <small>
                    {r.capacity} seats · {r.type}
                  </small>
                  <small>{r.equipment || "No equipment listed"}</small>
                  <span className="room-card-link">View room schedule →</span>
                </button>
              ))}
              {!results.length && (
                <Empty title="No suitable rooms">
                  Try another time, a different type, or fewer equipment
                  requirements.
                </Empty>
              )}
            </div>
          )}
        </div>
      </Panel>
      <Panel title="Room utilization">
        <div className="padded">
          <p className="note">
            Typical recurring week in the selected semester. Occupied minutes ÷
            available minutes; blocked time is excluded from available capacity.
            Multiple bookings of the same minute count once.
          </p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Room</th>
                <th>Type / capacity</th>
                <th>Occupied</th>
                <th>Available</th>
                <th>Utilization</th>
                <th>Schedule</th>
              </tr>
            </thead>
            <tbody>
              {data.rooms
                .filter((r) => r.active)
                .map((r) => {
                  const s = stats.get(r.id)!;
                  return (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.code}</strong>
                        <small className="block">{r.building}</small>
                      </td>
                      <td>
                        {r.type} · {r.capacity} seats
                      </td>
                      <td>{(s.occupied / 60).toFixed(1)} h</td>
                      <td>{(s.available / 60).toFixed(1)} h</td>
                      <td>
                        <div className="meter">
                          <span
                            style={{ width: `${Math.min(100, s.percent)}%` }}
                          />
                        </div>
                        {s.percent.toFixed(1)}%
                      </td>
                      <td>
                        <button onClick={() => setRoom(r.id)}>
                          View schedule
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Room weekly schedule">
        <div className="padded">
          <Reference
            data={data}
            entity="rooms"
            label="Select room"
            value={room}
            onChange={setRoom}
          />
          {room && (
            <>
              <p className="note">
                Availability and maintenance windows can be edited in Settings →
                Records → Room availability.
              </p>
              {data.roomAvailability
                .filter((a) => a.roomId === room)
                .map((a) => (
                  <p key={a.id} className="note">
                    {a.kind === "blocked" ? "Blocked" : "Available"}:{" "}
                    {
                      [
                        "Monday",
                        "Tuesday",
                        "Wednesday",
                        "Thursday",
                        "Friday",
                        "Saturday",
                        "Sunday",
                      ][a.day]
                    }{" "}
                    {a.start}–{a.end} {a.reason && `· ${a.reason}`}
                  </p>
                ))}
            </>
          )}
        </div>
        {room ? (
          <Timetable
            data={data}
            meetings={data.meetings.filter(
              (m) => m.roomId === room && offeringIds.has(m.offeringId),
            )}
          />
        ) : (
          <Empty title="Choose a room">
            Select a room to see its occupied weekly time slots.
          </Empty>
        )}
      </Panel>
    </>
  );
}
