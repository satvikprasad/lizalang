let capture (func : unit -> unit) =
    let old_stdout = Unix.dup Unix.stdout in
    let temp_file = Filename.temp_file "output" ".txt" in
    let fd = Unix.openfile temp_file [Unix.O_WRONLY; Unix.O_CREAT; Unix.O_TRUNC] 0o600 in
    
    Unix.dup2 fd Unix.stdout;
    Unix.close fd;
    
    (try func () with e -> 
        Unix.dup2 old_stdout Unix.stdout;
        Unix.close old_stdout;
        raise e);
    
    Out_channel.flush stdout;
    Unix.dup2 old_stdout Unix.stdout;
    Unix.close old_stdout;
    
    let ic = open_in temp_file in
    let result = really_input_string ic (in_channel_length ic) in
    close_in ic;
    Sys.remove temp_file;
    result

let run (source : string) =
    let tokens = Liza.Lexer.scan_tokens source in
    match Liza.Parser.parse_program tokens with
    | Ok (statements) -> (
        List.iter (fun s -> (
            match (Liza.Parser.eval_statement s Liza.Parser.global_env) with
            | Ok _ -> ()
            | Error (Liza.Parser.TypeError (msg, expr)) -> Printf.printf "TypeError: %s [%s]\n" msg (Liza.Parser.pretty_print_expr expr)
            | Error (Liza.Parser.IdentifierNotFound (msg, expr)) -> Printf.printf "IdentifierNotFound: %s [%s]\n" msg (Liza.Parser.pretty_print_expr expr)
            | Error (Liza.Parser.LookupError (id)) -> Printf.printf "Could not find variable '%s'.\n" id 
            | Error (Liza.Parser.AssignmentError (id)) -> Printf.printf "Could not assign to unknown variable '%s'.\n" id 

            | Error (Liza.Parser.IncorrectArgumentsError) -> Printf.printf "Passed incorrect number of arguments to function.\n"

            | Error (Liza.Parser.UncallableExpr expr) -> Printf.printf "UncallableExpr: Attempted to call expression %s that was not callable.\n" (Liza.Parser.pretty_print_expr expr)

            | Error (Liza.Parser.CapturedVariableNotExist var) -> Printf.printf "CapturedVariableNotExist: Can't capture non-existent variable %s\n" var
            )) statements
        )

            | Error (Liza.Parser.InvalidToken (msg, Some tok)) -> Printf.printf "PARSING ERROR: %s [%s]\n" msg (Liza.Lexer.token_to_string tok)
            | Error (Liza.Parser.InvalidToken (msg, None)) -> Printf.printf "PARSING ERROR: %s\n" msg

    | Error MissingSemicolon -> Printf.printf "PARSING ERROR: Missing semicolon.\n"
    | Error PrintInvalidExpression -> Printf.printf "PARSING ERROR: Expected either a string or a number within print.\n"
    | Error ExpectedEOF -> Printf.printf "Expected EOF, but ran out of tokens."

let _cors_conf = Dream_middleware_ext.Cors.make_cors_conf 
    ~allowed_origin:Dream_middleware_ext.Cors.WildCard
    ~allowed_methods:["POST"]
    ~allowed_headers:["Content-Type"]
    ~expose_headers:[]
    ()

let () = 
    Dream.run
    @@ Dream.logger
    @@ Dream.router [   
        Dream.options "/run" (fun _ ->
            Dream.empty ~headers:[
                ("Access-Control-Allow-Origin", "*");
                ("Access-Control-Allow-Methods", "GET, POST");
                ("Access-Control-Allow-Headers", "Content-Type");
            ] `OK
        );

        Dream.post "/run" (fun request ->
            Lwt.bind (Dream.body request) (fun body ->
                let json = Yojson.Basic.from_string body in
                let code = Yojson.Basic.Util.member "code" json |> Yojson.Basic.Util.to_string in
                let output = capture (fun () -> run code) in 
                Printf.printf "%s\n" output; flush stdout;
                output |>
                Dream.respond ~headers:[
                    ("Access-Control-Allow-Origin", "*");
                    ("Access-Control-Allow-Methods", "GET, POST");
                    ("Access-Control-Allow-Headers", "Content-Type");
                ]
            )
        )
    ]
