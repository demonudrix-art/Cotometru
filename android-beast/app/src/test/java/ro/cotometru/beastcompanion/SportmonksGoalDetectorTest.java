package ro.cotometru.beastcompanion;

import org.junit.Test;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.List;
import static org.junit.Assert.*;

public final class SportmonksGoalDetectorTest {
    private static JSONObject fixture() throws JSONException {
        return new JSONObject("{\"data\":{\"id\":19429278,\"name\":\"A vs B\",\"events\":[" +
            "{\"id\":1001,\"type_id\":14,\"player_name\":\"A\",\"result\":\"1-0\",\"minute\":13}," +
            "{\"id\":1002,\"type_id\":15,\"player_name\":\"B\",\"result\":\"2-0\",\"minute\":27}," +
            "{\"id\":1003,\"type_id\":16,\"player_name\":\"C\",\"result\":\"2-1\",\"minute\":45}," +
            "{\"id\":1004,\"type_id\":10,\"result\":\"2-1\"}," +
            "{\"id\":1005,\"type_id\":23,\"result\":\"3-1\"}," +
            "{\"id\":1006,\"type_id\":14,\"is_cancelled\":true,\"result\":\"3-1\"}," +
            "{\"type_id\":14,\"result\":\"4-1\"}]}}");
    }

    @Test public void goalOwnGoalPenaltyOnly() throws JSONException {
        List<SportmonksGoalDetector.Goal> goals =
            SportmonksGoalDetector.parse(fixture(), "19429278");
        assertEquals(3, goals.size());
        assertEquals("19429278:1001", goals.get(0).key);
        assertEquals(1, goals.get(0).goalNumber);
        assertEquals(2, goals.get(1).goalNumber);
        assertEquals(3, goals.get(2).goalNumber);
        assertEquals(14, goals.get(0).type);
        assertEquals(15, goals.get(1).type);
        assertEquals(16, goals.get(2).type);
    }

    @Test public void originalCompanionContract() throws JSONException {
        JSONObject event = SportmonksGoalDetector.parse(fixture(), "19429278")
            .get(0).toCompanionEvent();
        assertEquals("goal", event.getString("kind"));
        assertEquals("19429278:1001", event.getString("eventId"));
        assertEquals(1, event.getInt("goalNumber"));
        assertEquals("sportmonks", event.getString("source"));
    }

    @Test(expected=JSONException.class)
    public void rejectsOtherFixture() throws JSONException {
        SportmonksGoalDetector.parse(fixture(), "11111111");
    }

    @Test(expected=JSONException.class)
    public void requiresEventsInclude() throws JSONException {
        SportmonksGoalDetector.parse(
            new JSONObject("{\"data\":{\"id\":19429278,\"name\":\"A vs B\"}}"),
            "19429278");
    }

    @Test public void ignoresNonGoal() throws JSONException {
        JSONObject data = new JSONObject("{\"data\":[{\"id\":19429278,\"events\":["+
            "{\"id\":101,\"type_id\":19},{\"id\":102,\"type_id\":10}]}]}");
        assertTrue(SportmonksGoalDetector.parse(data,"19429278").isEmpty());
    }
}
