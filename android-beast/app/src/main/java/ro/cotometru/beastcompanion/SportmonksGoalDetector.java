package ro.cotometru.beastcompanion;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

/** Converts Sportmonks Football API v3 fixture events to distinct GOAL signals. */
final class SportmonksGoalDetector {
    static final class Goal {
        final String key, match, scorer, result, eventId;
        final int goalNumber, type, minute;
        Goal(String key, String match, String scorer, String result,
             String eventId, int goalNumber, int type, int minute) {
            this.key = key;
            this.match = match;
            this.scorer = scorer;
            this.result = result;
            this.eventId = eventId;
            this.goalNumber = goalNumber;
            this.type = type;
            this.minute = minute;
        }
        JSONObject toCompanionEvent() throws JSONException {
            return new JSONObject().put("kind", "goal")
                .put("eventId", eventId).put("goalNumber", goalNumber)
                .put("match", match).put("scorer", scorer)
                .put("at", String.valueOf(System.currentTimeMillis()))
                .put("result", result).put("minute", minute)
                .put("source", "sportmonks");
        }
    }

    static List<Goal> parse(JSONObject response, String expectedFixtureId) throws JSONException {
        if (expectedFixtureId == null || !expectedFixtureId.matches("[0-9]{1,15}"))
            throw new JSONException("ID Sportmonks invalid");
        Object data = response.opt("data");
        JSONArray fixtures = new JSONArray();
        if (data instanceof JSONObject) fixtures.put(data);
        else if (data instanceof JSONArray) fixtures = (JSONArray)data;
        else throw new JSONException("Sportmonks: răspuns fără data");

        List<Goal> result = new ArrayList<>();
        boolean found = false;
        for (int i = 0; i < fixtures.length(); i++) {
            JSONObject fixture = fixtures.optJSONObject(i);
            if (fixture == null) continue;
            String fixtureId = String.valueOf(fixture.optLong("id", -1));
            if (!expectedFixtureId.equals(fixtureId)) continue;
            found = true;
            JSONArray events = fixture.optJSONArray("events");
            if (events == null) throw new JSONException("Sportmonks: lipsește include=events");
            String match = fixture.optString("name", "Meci " + fixtureId);
            for (int j = 0; j < events.length(); j++) {
                JSONObject e = events.optJSONObject(j);
                if (e == null) continue;
                int type = e.optInt("type_id", -1);
                // Official Sportmonks types: 14 GOAL, 15 OWN GOAL, 16 PENALTY.
                // VAR=10 and penalty shootout=23 do not trigger touch.
                if (type != 14 && type != 15 && type != 16) continue;
                if (e.optBoolean("is_cancelled", false) || e.optBoolean("cancelled", false)) continue;
                long event = e.optLong("id", -1);
                if (event < 0) continue; // Never auto-tap on events without a stable ID.
                String eventId = fixtureId + ":" + event;
                String score = e.optString("result", "");
                int goalNo = parseGoalNumber(score);
                result.add(new Goal(eventId, match,
                    e.optString("player_name", type == 15 ? "Autogol" : "Gol"),
                    score, eventId, goalNo, type, e.optInt("minute", -1)));
            }
        }
        if (!found) throw new JSONException("Meciul Sportmonks nu există în răspuns");
        return result;
    }

    private static int parseGoalNumber(String score) {
        try {
            String[] parts = score.split("-");
            if (parts.length == 2)
                return Integer.parseInt(parts[0].trim()) + Integer.parseInt(parts[1].trim());
        } catch (RuntimeException ignored) {}
        return 0;
    }

    private SportmonksGoalDetector() {}
}
