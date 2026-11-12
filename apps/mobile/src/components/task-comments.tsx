import { useState } from "react";
import { View } from "react-native";
import { Action, Body, Field, Heading } from "./ui";
import { useTempo } from "../data/store";
type Comment = { id: string; name: string; message: string; at: string };
export function TaskComments({
  ownerId,
  taskId,
}: {
  ownerId: string;
  taskId: string;
}) {
  const [comments, setComments] = useState<Comment[] | null>(null),
    [message, setMessage] = useState("");
  const cloud = useTempo((s) => s.cloudRequest);
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
        }}
      />
      {comments && (
        <>
          <Heading small>Task comments</Heading>
          {!comments.length && <Body small>No comments yet.</Body>}
          {comments.map((c) => (
            <View key={c.id} style={{ gap: 3 }}>
              <Body small>
                {c.name} · {new Date(c.at).toLocaleString()}
              </Body>
              <Body>{c.message}</Body>
            </View>
          ))}
          <Field
            label="Comment (up to 2,000 characters)"
            value={message}
            onChangeText={setMessage}
          />
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
