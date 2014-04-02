<%@ WebHandler Language="C#" Class="GetGameData" %>

using System;
using System.Web;

public class GetGameData : IHttpHandler {
    
    public void ProcessRequest (HttpContext context) {
        context.Response.ContentType = "text/plain";
        try
        {
            if (context.Request.Params["op"] == "getturn")
            {
                string filename = context.Request.Params["filename"];
                string path = System.Web.Configuration.WebConfigurationManager.AppSettings["datafolder"];
                filename = System.IO.Path.Combine(path, filename);
                context.Response.WriteFile(filename);
            }
            else if (context.Request.Params["op"] == "getgames")
            {
                context.Response.Write("{ games: [\n");
                string path = System.Web.Configuration.WebConfigurationManager.AppSettings["datafolder"];
                var games = new System.Collections.Generic.Dictionary<string, System.Collections.Generic.List<string>>();
                foreach (string aFilename in System.IO.Directory.GetFiles(path, "*.txt"))
                {
                    string filename = System.IO.Path.GetFileNameWithoutExtension(aFilename);
                    int i = filename.IndexOf("_gamestate_");
                    if (i > 0)
                    {
                        string gamename = filename.Substring(0, i);
                        string turn = filename.Substring(i+"_gamestate_".Length);
                        if (turn == "sot0") continue; // Start of turn 0 game state is incomplete
                        turn = turn.Replace("sot", "");
                        turn = turn.Replace("eot", "");
                        turn = turn.Replace("_player", "p");
                        if (!games.ContainsKey(gamename)) games.Add(gamename, new System.Collections.Generic.List<string>());
                        games[gamename].Add(turn);
                    }
                }
                var gamenames = new System.Collections.Generic.List<string>(games.Keys);
                gamenames.Sort();
                int id = 1;
                foreach (var gamename in gamenames)
                {
                    if (id > 1) context.Response.Write(",\n");
                    var turns = games[gamename];
                    turns.Sort();
                    context.Response.Write("{id: " + (id++) + ", name: \"" + gamename + "\", filename: \"" + gamename + "_gamestate_${turn}.txt\", turns: [\"" + string.Join("\",\"", turns.ToArray()) + "\"]}");
                }
                context.Response.Write("\n]}");
                //{
                //    "games" : [
                //        //{"id": 1, "name": "Novice's Game", filename: "Novice's Game Turn ${turn}.json", turns: [9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51]},
                //        //{"id": 2, "name": "Chump's Game", filename: "Chump's Game Turn ${turn}.json", turns: [0,1,2,3,4,5,6,7]},
                //        //{"id": 3, "name": "Continents Test Game", filename: "Test Game Continents Turn ${turn}.json", turns: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52]},
                //        //{"id": 4, "name": "PBEM Duel", filename: "PBEM Duel Turn ${turn}.json", turns: [1,5,6,'7p0','7p1','8p0']},
                //        //{"id": 5, "name": "PBEM 23", filename: "RBPBEM23 Turn ${turn}.json", turns: ['124p1']},
                //        {"id": 6, "name": "PBEM 46", filename: "PBEM46 Turn ${turn}.json", turns: ['125p3','126p3','127p3','128p3','129p3','130p3','131p3','132p3','133p3','134p3','135p3','136p3','137p3','138p3','139p3','140p3','141p3','142p3','143p3','144p3','145p3','146p3']}
                //    ]
                //}
            }
            else
            {
                throw new Exception("Unsupported operation " + context.Request["op"]);
            }
        }
        catch (Exception ex)
        {
            context.Response.Write("{ error: \"" + ex.Message.Replace("\"", "") + "\" }");
        }
    }
 
    public bool IsReusable {
        get {
            return false;
        }
    }

}