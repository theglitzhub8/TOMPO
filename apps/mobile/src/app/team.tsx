import { useEffect, useState } from "react";
import { View } from "react-native";
import {
  Screen,
  Card,
  Body,
  Button,
  Action,
  Heading,
  Field,
  Notice,
} from "../components/ui";
import { TaskComments } from "../components/task-comments";
import { useTempo } from "../data/store";
import {
  localInstant,
  localParts,
} from "../../../../packages/core/src/scheduling";
type Project = {
  ownerId: string;
  projectId: string;
  title: string;
  ownerName: string;
  status: "owner" | "accepted" | "pending";
};
type Detail = {
  members: { id: string; name: string; status: string }[];
  tasks: {
    id: string;
    task: {
      title: string;
      duration: number;
      status: string;
      scheduledAt: string | null;
    };
    assigneeId: string | null;
    assigneeName: string | null;
  }[];
};
type TeamData = {
  projects: Project[];
  busy: { id: string; start: string; duration: number }[];
};
export default function Team() {
  const { user, cloudRequest: cloud, preferences, shares } = useTempo();
  const [data, setData] = useState<TeamData>({ projects: [], busy: [] }),
    [error, setError] = useState("");
  const [selected, setSelected] = useState<Project | null>(null),
    [detail, setDetail] = useState<Detail | null>(null),
    [email, setEmail] = useState("");
  const [date, setDate] = useState(
      localParts(new Date(), preferences.timezone).date,
    ),
    [clock, setClock] = useState("09:00"),
    [duration, setDuration] = useState("60");
  const load = async () => setData(await cloud<TeamData>("/v1/team"));
  useEffect(() => {
    let live = true;
    cloud<TeamData>("/v1/team")
      .then((r) => {
        if (live) setData(r);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [cloud]);
  const open = async (p: Project) => {
    setDetail(null);
    const r = await cloud<Detail>(
      `/v1/team/project?owner=${p.ownerId}&id=${encodeURIComponent(p.projectId)}`,
    );
    setSelected(p);
    setDetail(r);
  };
  const refresh = async () => {
    await load();
    if (selected) await open(selected);
  };
  return (
    <Screen
      title="Work, together."
      eyebrow="SHARED PROJECTS"
      subtitle="Project owners manage membership and assignments. Accepted members can view tasks, comment, and update completion."
    >
      <Action title="Refresh shared work" variant="secondary" run={refresh} />
      {!!error && <Notice tone="danger">{error}</Notice>}
      {!data.projects.length && (
        <Card>
          <Body>
            Create a project in Projects, then return here to invite teammates.
          </Body>
        </Card>
      )}
      {data.projects.map((p) => (
        <Card key={`${p.ownerId}:${p.projectId}`}>
          <Heading small>{p.title}</Heading>
          <Body small>
            {p.ownerName} · {p.status}
          </Body>
          {p.status === "pending" ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Action
                title="Accept"
                compact
                run={async () => {
                  await cloud("/v1/team/respond", {
                    ownerId: p.ownerId,
                    projectId: p.projectId,
                    accept: true,
                  });
                  await load();
                }}
              />
              <Action
                title="Decline"
                compact
                variant="secondary"
                run={async () => {
                  await cloud("/v1/team/respond", {
                    ownerId: p.ownerId,
                    projectId: p.projectId,
                    accept: false,
                  });
                  await load();
                }}
              />
            </View>
          ) : (
            <Action
              title="Open project"
              compact
              variant="secondary"
              run={() => open(p)}
            />
          )}
        </Card>
      ))}
      {selected && detail && (
        <Card key={`${selected.ownerId}:${selected.projectId}`}>
          <Heading serif>{selected.title}</Heading>
          <Body small>Owner: {selected.ownerName}</Body>
          {detail.members.map((m) => (
            <View key={m.id} style={{ gap: 5 }}>
              <Body>
                {m.name} · {m.status}
              </Body>
              {(selected.ownerId === user?.id || m.id === user?.id) && (
                <Action
                  title={m.id === user?.id ? "Leave project" : "Remove member"}
                  compact
                  variant="ghost"
                  run={async () => {
                    await cloud("/v1/team/remove", {
                      ownerId: selected.ownerId,
                      projectId: selected.projectId,
                      memberId: m.id,
                    });
                    if (m.id === user?.id) {
                      setSelected(null);
                      setDetail(null);
                      await load();
                    } else await refresh();
                  }}
                />
              )}
            </View>
          ))}
          {selected.ownerId === user?.id && (
            <>
              <Field
                label="Invite an existing Tempo account by email"
                value={email}
                onChangeText={setEmail}
              />
              <Body small>
                Accepting gives this person access to every task and comment in
                this project.
              </Body>
              <Action
                title="Invite to project"
                run={async () => {
                  await cloud("/v1/team/invite", {
                    projectId: selected.projectId,
                    email,
                  });
                  setEmail("");
                  await refresh();
                }}
              />
            </>
          )}
          {detail.tasks.map((t) => (
            <Card key={t.id}>
              <Heading small>{t.task.title}</Heading>
              <Body small>
                {t.task.status} ·{" "}
                {t.assigneeName
                  ? `Assigned to ${t.assigneeName}`
                  : "Unassigned"}
              </Body>
              <Action
                title={
                  t.task.status === "completed" ? "Reopen task" : "Mark done"
                }
                compact
                variant="secondary"
                run={async () => {
                  await cloud("/v1/team/done", {
                    ownerId: selected.ownerId,
                    taskId: t.id,
                    done: t.task.status !== "completed",
                  });
                  await refresh();
                  if (selected.ownerId === user?.id)
                    await useTempo.getState().reload();
                }}
              />
              {selected.ownerId === user?.id && (
                <View style={{ gap: 8 }}>
                  <Body small>Assign to</Body>
                  <View
                    style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}
                  >
                    {[
                      { id: user.id, name: "Me" },
                      ...detail.members.filter((m) => m.status === "accepted"),
                    ].map((m) => (
                      <Action
                        key={m.id}
                        title={`${t.assigneeId === m.id ? "✓ " : ""}${m.name}`}
                        compact
                        variant="secondary"
                        run={async () => {
                          await cloud("/v1/team/assign", {
                            taskId: t.id,
                            memberId: m.id,
                          });
                          await refresh();
                        }}
                      />
                    ))}
                    <Action
                      title="Unassigned"
                      compact
                      variant="ghost"
                      run={async () => {
                        await cloud("/v1/team/assign", {
                          taskId: t.id,
                          memberId: null,
                        });
                        await refresh();
                      }}
                    />
                  </View>
                </View>
              )}
              <TaskComments ownerId={selected.ownerId} taskId={t.id} />
            </Card>
          ))}
          {!detail.tasks.length && (
            <Body>Add tasks to this project from Tasks or Tell Tempo.</Body>
          )}
          <Button
            title="Close project"
            variant="ghost"
            onPress={() => {
              setSelected(null);
              setDetail(null);
            }}
          />
        </Card>
      )}
      <Card>
        <Heading>Your busy times</Heading>
        <Body small>
          Only times and durations are shared with owners of projects you have
          accepted. Weekly planning avoids these windows for their project
          tasks.
        </Body>
        <Field
          label={`Date YYYY-MM-DD · ${preferences.timezone}`}
          value={date}
          onChangeText={setDate}
        />
        <Field label="Start HH:mm" value={clock} onChangeText={setClock} />
        <Field
          label="Minutes"
          value={duration}
          onChangeText={setDuration}
          numeric
        />
        <Action
          title="Add busy time"
          run={async () => {
            await cloud("/v1/team/busy", {
              start: localInstant(
                date,
                clock,
                preferences.timezone,
              ).toISOString(),
              duration: Number(duration),
            });
            await load();
          }}
        />
        {data.busy.map((b) => (
          <View key={b.id} style={{ gap: 5 }}>
            <Body small>
              {localParts(new Date(b.start), preferences.timezone).date} ·{" "}
              {localParts(new Date(b.start), preferences.timezone).clock} ·{" "}
              {b.duration} min
            </Body>
            <Action
              title="Remove busy time"
              compact
              variant="ghost"
              run={async () => {
                await cloud("/v1/team/busy", { removeId: b.id });
                await load();
              }}
            />
          </View>
        ))}
      </Card>
      {shares.incoming
        .filter((s) => s.status === "accepted")
        .map((s) => (
          <Card key={`${s.ownerId}:${s.taskId}`}>
            <Heading small>
              {s.task.title} · with {s.ownerName}
            </Heading>
            <TaskComments ownerId={s.ownerId} taskId={s.taskId} />
          </Card>
        ))}
    </Screen>
  );
}
