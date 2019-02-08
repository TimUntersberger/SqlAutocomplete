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

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log(
        'Congratulations, your extension "oracle-sql-autocomplete" is now active!'
    )

    getSqlStatement(
        `select * from users;
        select  from users;`,
        new vscode.Position(1, 7)
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

    const keywords = ["select", "from"]

    const autocomplete = vscode.languages.registerCompletionItemProvider(
        "*",
        {
            provideCompletionItems(
                document: vscode.TextDocument,
                position: vscode.Position,
                token: vscode.CancellationToken
            ) {
                const sqlString = getSqlStatement(document.getText(), position)
                const sql = parseSql(sqlString)
                const completionItems: vscode.CompletionItem[] = []

                if (selectedDb != "") {
                    const tables = databases[selectedDb].tables

                    Object.keys(tables).forEach(tableKey => {
                        const table = tables[tableKey]

                        completionItems.push(
                            new vscode.CompletionItem(tableKey)
                        )

                        Object.keys(table.columns).forEach(columnKey => {
                            completionItems.push(
                                new vscode.CompletionItem(
                                    `${tableKey}.${columnKey}`
                                )
                            )
                        })
                    })
                }

                keywords.forEach(word =>
                    completionItems.push(new vscode.CompletionItem(word))
                )

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

    /*TODO: 
        somehow remove the requirement that you have to select the whole sql statement.
        maybe just place the cursor inside the statement
    */
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
                            console.log(result)
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
