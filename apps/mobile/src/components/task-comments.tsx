import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { Action, Body, Field, Heading } from "./ui";
import { useTempo } from "../data/store";
import { theme } from "../design/tokens";
type Comment = {
  id: string;
  name: string;
  message: string;
  at: string;
  authorId: string;
  mine: boolean;
};
const reasons = ["Spam", "Harassment or hate", "Inappropriate content", "Something else"];
function Link({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Text
      accessibilityRole="button"
      onPress={onPress}
      suppressHighlighting
      style={{ fontFamily: theme.fonts.bold, fontSize: 12.5, color: theme.muted, paddingVertical: 4 }}
    >
      {title}
    </Text>
  );
}
export function TaskComments({
  ownerId,
  taskId,
}: {
  ownerId: string;
  taskId: string;
}) {
  const [comments, setComments] = useState<Comment[] | null>(null),
    [message, setMessage] = useState(""),
    [notice, setNotice] = useState("");
  const cloud = useTempo((s) => s.cloudRequest);
  const fail = (e: unknown) =>
    Alert.alert("Couldn’t do that", e instanceof Error ? e.message : String(e));
  const report = (c: Comment) =>
    Alert.alert(
      "Report this comment?",
      "Tempo reviews reports within 24 hours and removes content that breaks the rules. The comment is hidden for you now.",
      [
        ...reasons.map((reason) => ({
          text: reason,
          onPress: async () => {
            try {
              await cloud("/v1/team/report", { commentId: c.id, reason });
              setComments((all) => all?.filter((x) => x.id !== c.id) ?? null);
              setNotice("Thanks. We’ll review this comment within 24 hours.");
            } catch (e) {
              fail(e);
            }
          },
        })),
        { text: "Cancel", style: "cancel" as const },
      ],
    );
  const block = (c: Comment) =>
    Alert.alert(
      `Block ${c.name}?`,
      "You won’t see their comments or get notified about them, and they can’t invite you to projects or tasks. You can unblock them in Me → Blocked people.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            try {
              await cloud("/v1/team/block", { userId: c.authorId });
              setComments((all) => all?.filter((x) => x.authorId !== c.authorId) ?? null);
              setNotice(`${c.name} is blocked.`);
            } catch (e) {
              fail(e);
            }
          },
        },
      ],
    );
  return (
    <View style={{ gap: 10 }}>
      <Action
        title={comments ? "Refresh comments" : "Open comments"}
        variant="ghost"
        compact
        run={async () => {
          const r = await cloud<{ comments: Comment[] }>(
            `/v1/team/comments?owner=${encodeURIComponent(ownerId)}&id=${encodeURIComponent(taskId)}`,
          );
          setComments(r.comments);
          setNotice("");
        }}
      />
      {comments && (
        <>
          <Heading small>Task comments</Heading>
          {!!notice && <Body small>{notice}</Body>}
          {!comments.length && <Body small>No comments yet.</Body>}
          {comments.map((c) => (
            <View key={c.id} style={{ gap: 3 }}>
              <Body small>
                {c.name} · {new Date(c.at).toLocaleString()}
              </Body>
              <Body>{c.message}</Body>
              {!c.mine && (
                <View style={{ flexDirection: "row", gap: 18 }}>
                  <Link title="Report" onPress={() => report(c)} />
                  <Link title={`Block ${c.name.split(/\s+/)[0]}`} onPress={() => block(c)} />
                </View>
              )}
            </View>
          ))}
          <Field
            label="Comment (up to 2,000 characters)"
            value={message}
            onChangeText={setMessage}
          />
          <Body small>Keep it kind. Abusive comments can be reported and removed.</Body>
          <Action
            title="Post comment"
            run={async () => {
              const r = await cloud<{ comments: Comment[] }>(
                "/v1/team/comments",
                { ownerId, taskId, message },
              );
              setComments(r.comments);
              setMessage("");
            }}
          />
        </>
      )}
    </View>
  );
}
