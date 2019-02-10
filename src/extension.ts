// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode"
import * as mysql from "mysql"
import getSqlStatement from "./getSqlStatement"
import parseSql from "./parseSql"

const databases: any = {}
let selectedDb = ""

function createConnection() {
    return mysql.createConnection({
        host: "127.0.0.1",
        user: "root",
        password: "root"
    })
}

function createSqlResultHtml(result, columnNames) {
    return `
    <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>SQL Result</title>
            <style>
                table {
                    width: 100%;
                    color: black;
                }

                th {
                    text-align: left;
                }
            </style>
        </head>
        <body>
            <table>
                <tr>
                ${columnNames.map(x => `<th>${x}</th>`).join("\n")}
                </tr>
                ${result
                    .map(
                        row => `
                    <tr>
                        ${columnNames
                            .map(
                                column => `
                                <td>${row[column]}</td>
                            `
                            )
                            .join("\n")}
                    </tr>
                `
                    )
                    .join("\n")}
            </table>
        </body>
        </html>
    `
}

function addItemsToCompletionList(
    list,
    items,
    kind = vscode.CompletionItemKind.Text
) {
    items.forEach(i => {
        list.push(new vscode.CompletionItem(i, kind))
    })
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log(
        'Congratulations, your extension "oracle-sql-autocomplete" is now active!'
    )

    const conn = createConnection()

    const databasesToIgnore = [
        "information_schema",
        "performance_schema",
        "mysql",
        "sys"
    ]

    const sql = `select * from information_schema.tables tables 
		join information_schema.columns columns on columns.table_name = tables.table_name 
		where ${databasesToIgnore
            .map(db => `columns.table_schema != '${db}'`)
            .join(" and ")};`

    conn.connect(err => {
        if (err) {
            console.log(err)
            return
        }
        conn.query(sql, (err, result, fields) => {
            for (const combination of result) {
                if (databases[combination.TABLE_SCHEMA] == undefined) {
                    databases[combination.TABLE_SCHEMA] = {}
                    databases[combination.TABLE_SCHEMA].tables = {}
                }
                const db = databases[combination.TABLE_SCHEMA]
                if (db.tables[combination.TABLE_NAME] == undefined) {
                    db.tables[combination.TABLE_NAME] = {}
                    db.tables[combination.TABLE_NAME].columns = {}
                }
                const table = db.tables[combination.TABLE_NAME]
                if (table.columns[combination.COLUMN_NAME] == undefined) {
                    table.columns[combination.COLUMN_NAME] = {}
                }
            }
            conn.end()
        })
    })

    const keywords = ["select", "from", "join", "on", "where"]

    const autocomplete = vscode.languages.registerCompletionItemProvider(
        "*",
        {
            provideCompletionItems(
                document: vscode.TextDocument,
                position: vscode.Position,
                token: vscode.CancellationToken
            ) {
                if (selectedDb == "") {
                    return
                }

                const { sql, cursorPosition } = getSqlStatement(
                    document.getText(),
                    position
                )
                const tokens = parseSql(sql)
                const tables = databases[selectedDb].tables
                const completionItems: vscode.CompletionItem[] = []

                if (tokens) {
                    const missingTokens: {
                        previous: string
                        next: string
                        index: number
                    }[] = []

                    for (let i = 0; i < tokens.length; i++) {
                        if (tokens[i] == null) {
                            missingTokens.push({
                                previous: tokens[i - 1],
                                index: i,
                                next: tokens[i + 1]
                            })
                        }
                    }

                    if (tokens[0] === "select") {
                        const columns = tokens[1]
                        const table = tokens[3]
                        const joins = tokens[4]
                        const where = tokens[5]

                        if (columns == null) {
                            addItemsToCompletionList(
                                completionItems,
                                Object.keys(
                                    tables[
                                        typeof table === "object"
                                            ? table[0]
                                            : table
                                    ].columns
                                ),
                                vscode.CompletionItemKind.Property
                            )
                        } else if (table == null) {
                            addItemsToCompletionList(
                                completionItems,
                                Object.keys(tables),
                                vscode.CompletionItemKind.Class
                            )
                        } else if (joins.length == 0 && where == null) {
                            addItemsToCompletionList(
                                completionItems,
                                ["join", "where"],
                                vscode.CompletionItemKind.Keyword
                            )
                        } else if (joins.length != 0) {
                            for (const join of joins) {
                                const joinTable = join[1]
                                const isOnKeywordPresent = join[2] != null
                                const joinOn = join[3]

                                if (joinTable == null) {
                                    addItemsToCompletionList(
                                        completionItems,
                                        Object.keys(tables),
                                        vscode.CompletionItemKind.Class
                                    )
                                } else if (!isOnKeywordPresent) {
                                    completionItems.push(
                                        new vscode.CompletionItem(
                                            "on",
                                            vscode.CompletionItemKind.Keyword
                                        )
                                    )
                                }
                            }
                        }
                    }
                } else {
                    addItemsToCompletionList(
                        completionItems,
                        keywords,
                        vscode.CompletionItemKind.Keyword
                    )
                }

                console.log(tokens)

                return completionItems
            }
        },
        ""
    )

    const setDb = vscode.commands.registerCommand(
        "oracle-sql-autocomplete.setDb",
        async () => {
            const selectedItem = await vscode.window.showQuickPick(
                Object.keys(databases),
                {
                    canPickMany: false,
                    placeHolder: "Select a database"
                }
            )

            if (selectedItem) selectedDb = selectedItem
        }
    )
    const executeQuery = vscode.commands.registerCommand(
        "oracle-sql-autocomplete.executeQuery",
        (...args: any[]) => {
            const activeEditor = vscode.window.activeTextEditor

            if (activeEditor) {
                const sql = getSqlStatement(
                    activeEditor.document.getText(),
                    activeEditor.selection.active
                )

                const conn = createConnection()
                conn.connect(err => {
                    if (err) {
                        console.log(err)
                        return
                    }
                    if (selectedDb == "") {
                        vscode.window.showErrorMessage(
                            "Please select a database before trying to execute a query"
                        )
                        return
                    }
                    conn.query("use " + selectedDb, () => {
                        conn.query(sql, (err, result, fields = []) => {
                            if (err) {
                                console.log(err)
                                return
                            }
                            const columnNames = fields.map(f => f.name)
                            const panel = vscode.window.createWebviewPanel(
                                "sqlResult",
                                "SQL Result",
                                vscode.ViewColumn.One,
                                {}
                            )
                            panel.webview.html = createSqlResultHtml(
                                result,
                                columnNames
                            )
                        })
                        conn.end()
                    })
                })
            }
        }
    )

    context.subscriptions.push(autocomplete)
    context.subscriptions.push(executeQuery)
    context.subscriptions.push(setDb)
}

// this method is called when your extension is deactivated
export function deactivate() {}
