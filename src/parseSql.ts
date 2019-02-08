import * as pegjs from "pegjs"

export const peg = `
    start
        = x:statement ";"? { return x }

    statement
        = selectStatement
        / insertStatement
        / updateStatement
        / deleteStatement

    insertStatement
        = "insert into users(name, id) values('test', 0);"

    updateStatement
        = "update users set id = 0, name = 'test' where id = 1;"

    deleteStatement
        = "delete from users where id = 0;"

    selectStatement
        = "select" _ columns:columns? _ "from" _ table:tableName? joins:((_ joinExpression)*) _ where:whereExpression? 
        { return ["select", columns, "from", table, joins.map(join => join.filter(x => (typeof x) === "object")[0]), where] }

    joinExpression
        = "join" _ table:tableName? _ exp:joinOnExpression? { return ["join", table, ...(exp || [null])] } 

    joinOnExpression
        = "on" _ exp:compareExpression? { return ["on", ...(exp || [null])] }

    whereExpression
        = "where" _ exp:booleanExpression? { return ["where", ...(exp || [null])]}

    booleanExpression
        = compareExpression

    compareExpression
        = left:attributeName? _ "=" _ right:attributeName? { return [ left, "=", right ] }

    attributeName
        = table:name "." attribute:name? { return table + "." + attribute }
        / name 

    columns
        = first:attributeName rest:("," _ attributeName)* { return [first, ...rest.map(x => x[2])]}
        / "*" { return "*" }

    name
        = !reserved first:[a-zA-Z] rest:[a-zA-Z0-9]* { return first + rest.join("") }

    reserved
        = keyword

    keyword
        = "select"
        / "from"
        / "join"
        / "where"
        / "on"

    tableName
        = original:name _ "alias"? _ alias:name { return [original, alias] }
        / name

    whitespace
        = " "
        / "\\n"
        / "\\r"
    _
        = whitespace* { return "" }
    
    __
        = whitespace+ { return "" }
`

const parser = pegjs.generate(peg)

export default function(sqlString: string): Array<any> | null {
    try {
        return (<Array<any>>parser.parse(sqlString)).filter(x => x !== "")
    } catch (e) {
        console.log(e.message)
        return null
    }
}
