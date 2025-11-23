let rec construct_ast_json_from_expr (expression: Liza.Parser.expr) : Yojson.Basic.t = 
    match expression with
    | Liza.Parser.Literal l -> `Assoc [
        ("type", `String "literal");
        (
            "value", 
            match l with 
            | Liza.Parser.Number n -> `Assoc [
                ("type", `String "number");
                ("value", `Float n)
            ]
            | Liza.Parser.String s -> `Assoc [
                ("type", `String "string");
                ("value", `String s)
            ]
            | Liza.Parser.Callable (args, body, captures, _env) -> `Assoc [
                ("type", `String "callable");
                ("args", `List (List.map (fun arg ->
                    `String arg
                ) args));
                ("captures", `List (List.map (fun capture ->
                    `String capture) captures));
                ("body", construct_ast_json_from_stat body)
            ]
            | True -> `Assoc [
                ("type", `String "true");
                ("value", `Bool true)
            ]
            | False -> `Assoc [
                ("type", `String "false");
                ("value", `Bool false)
            ]
            | Nil -> `Assoc [
                ("type", `String "nil");
                ("value", `Null)
            ]
        )
    ]
    | Liza.Parser.Identifier id -> `Assoc [
        ("type", `String "identifier");
        ("value", `String id);
    ]
    | Liza.Parser.Unary (op, expr) -> `Assoc [
        ("type", `String "unary");
        ("value", `Assoc [
            ("operator", match op with
            | Bang -> `String "!"
            | Minus -> `String "-");
            ("expression", construct_ast_json_from_expr expr)
        ])
    ]
    | Liza.Parser.Binary (expr1, op, expr2) -> `Assoc [
        ("type", `String "binary");
        ("value", `Assoc [
            ("left", construct_ast_json_from_expr expr1);
            ("operator", `String (Liza.Parser.binary_op_to_lexeme op));
            ("right", construct_ast_json_from_expr expr2);
        ])
    ]
    | Liza.Parser.Grouping expr -> `Assoc [
        ("type", `String "grouping");
        ("value", `Assoc [
            ("expression", construct_ast_json_from_expr expr)
        ]);
    ]
    | Liza.Parser.Assignment (id, expr) -> `Assoc [
        ("type", `String "assignment");
        ("value", `Assoc [
            ("identifier", `String id);
            ("expression", construct_ast_json_from_expr expr)
        ])
    ]
    | Liza.Parser.Call (expr, args) -> `Assoc [
        ("type", `String "call");
        ("value", `Assoc [
            ("callable", construct_ast_json_from_expr expr);
            ("args", `List (List.map (fun arg ->
                construct_ast_json_from_expr arg
            ) args))
        ])
    ]

and construct_ast_json_from_stat (statement: Liza.Parser.statement) : Yojson.Basic.t =
    match statement with 
    | If (cond, clause1, Some clause2) -> `Assoc [
        ("statement", `String "if");
        ("children", `Assoc [
            ("condition", construct_ast_json_from_expr cond);
            ("clause1", construct_ast_json_from_stat clause1);
            ("clause2", construct_ast_json_from_stat clause2);
        ])
    ]
    | If (cond, clause1, None) -> `Assoc [
        ("statement", `String "if");
        ("children", `Assoc [
            ("condition", construct_ast_json_from_expr cond);
            ("clause1", construct_ast_json_from_stat clause1);
            ("clause2", `Null);
        ])
    ]
    | While (cond, body) -> `Assoc [
        ("statement", `String "while");
        ("children", `Assoc [
            ("condition", construct_ast_json_from_expr cond);
            ("body", construct_ast_json_from_stat body);
        ])
    ]
    | Return expr -> `Assoc [
        ("statement", `String "ret");
        ("children", `Assoc [
            ("expression", construct_ast_json_from_expr expr)
        ])
    ]
    | For (init, incr, cond, body) -> `Assoc [
        ("statement", `String "for");
        ("children", `Assoc [
            ("initializer", construct_ast_json_from_stat init);
            ("increment", construct_ast_json_from_expr incr);
            ("condition", construct_ast_json_from_expr cond);
            ("body", construct_ast_json_from_stat body);
        ])
    ]
    | Block (statements) -> `Assoc [
        ("statement", `String "block");
        ("children", `List (List.map (fun statement -> construct_ast_json_from_stat statement) statements))
    ]
    | Expression expr -> `Assoc [
        ("statement", `String "expression");
        ("children", `Assoc [
            ("expression", construct_ast_json_from_expr expr)
        ])
    ]
    | Print expr -> `Assoc [
        ("statement", `String "print");
        ("children", `Assoc [
            ("expression", construct_ast_json_from_expr expr)
        ])
    ]
    | VarDecl (id, expr) -> `Assoc [
        ("statement", `String "declaration");
        ("children", `Assoc [
            ("variable", `String id);
            ("expression", construct_ast_json_from_expr expr)
        ])
    ]

let rec construct_ast_json (statements: Liza.Parser.statement list) : Yojson.Basic.t = 
    match statements with 
    | [] -> `List []
    | hd :: tl -> let rest = construct_ast_json tl in
        match rest with 
        | `List items -> 
            `List (
                construct_ast_json_from_stat hd :: items
            )
        | _ -> failwith "unexpected"

let capture (func : unit -> 'a): string * 'a =
    let old_stdout = Unix.dup Unix.stdout in
    let temp_file = Filename.temp_file "output" ".txt" in
    let fd = Unix.openfile temp_file [Unix.O_WRONLY; Unix.O_CREAT; Unix.O_TRUNC] 0o600 in
    
    Unix.dup2 fd Unix.stdout;
    Unix.close fd;
    
    try (
        let out = func () in (
            Out_channel.flush stdout;
            Unix.dup2 old_stdout Unix.stdout;
            Unix.close old_stdout;
            
            let ic = open_in temp_file in
            let result = really_input_string ic (in_channel_length ic) in
            close_in ic;
            Sys.remove temp_file;
            (result, out)
        )
    )
    with e -> 
        Unix.dup2 old_stdout Unix.stdout;
        Unix.close old_stdout;
        raise e

let run (source : string): Yojson.Basic.t option =
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
        );
        Some (construct_ast_json statements);

    | Error (Liza.Parser.InvalidToken (msg, Some tok)) -> Printf.printf "PARSING ERROR: %s [%s]\n" msg (Liza.Lexer.token_to_string tok); None
    | Error (Liza.Parser.InvalidToken (msg, None)) -> Printf.printf "PARSING ERROR: %s\n" msg; None

    | Error MissingSemicolon -> Printf.printf "PARSING ERROR: Missing semicolon.\n"; None
    | Error PrintInvalidExpression -> Printf.printf "PARSING ERROR: Expected either a string or a number within print.\n"; None
    | Error ExpectedEOF -> Printf.printf "Expected EOF, but ran out of tokens."; None

let _cors_conf = Dream_middleware_ext.Cors.make_cors_conf 
    ~allowed_origin:Dream_middleware_ext.Cors.WildCard
    ~allowed_methods:["POST"]
    ~allowed_headers:["Content-Type"]
    ~expose_headers:[]
    ()

let () = 
    Dream.run ~interface:"0.0.0.0" ~port:(int_of_string (Sys.getenv "PORT"))
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
                let output, ast = capture (fun () -> run code) in 
                Printf.printf "%s\n" output; flush stdout;
                Yojson.Basic.to_string (`Assoc [
                    ("output", `String output);
                    (
                        "ast", 
                        match ast with 
                        | Some ast -> ast
                        | _ -> `Null
                    )
                ]) |>
                Dream.json ~headers:[
                    ("Access-Control-Allow-Origin", "*");
                    ("Access-Control-Allow-Methods", "GET, POST");
                    ("Access-Control-Allow-Headers", "Content-Type");
                ]
            )
        )
    ]
