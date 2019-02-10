import * as vscode from "vscode"

function getLeft(
    text: string,
    index: number,
    delimiter: string = ";",
    requireNonWhiteSpace = false
): number {
    let start = index
    let foundNonWhitespace = !requireNonWhiteSpace

    for (; start > 0; start--) {
        if (foundNonWhitespace && text[start] === delimiter) {
            break
        }

        if (!foundNonWhitespace && text[start] != " ") {
            foundNonWhitespace = true
        }
    }
    return start
}

function getRight(
    text: string,
    index: number,
    delimiter: string = ";",
    requireNonWhiteSpace = false
): number {
    let end = index
    let foundNonWhitespace = !requireNonWhiteSpace

    for (; end < text.length; end++) {
        if (foundNonWhitespace && text[end] === delimiter) {
            break
        }

        if (!foundNonWhitespace && text[end] != " ") {
            foundNonWhitespace = true
        }
    }

    return end
}

function getCursorIndex(text: string, position: vscode.Position) {
    const lines = text.split("\n")
    let index = position.character - 1
    for (let i = 0; i < position.line; i++) {
        index += lines[i].length
    }
    return index
}
export default function(
    text: string,
    position: vscode.Position
): { sql: string; cursorPosition: object } {
    const index = getCursorIndex(text, position)
    const { start, end } = {
        start: getLeft(text, index),
        end: getRight(text, index)
    }
    const sql = text.substr(start, end - start).trim()

    // get sql statement

    const cursorSpan = {
        start: getLeft(sql, index, " ", true),
        end: getRight(sql, index, " ", true)
    }

    const cursorSpanText = sql
        .substr(cursorSpan.start, cursorSpan.end - cursorSpan.start)
        .trim()

    let previous: String | null = null
    let next: String | null = null

    if (cursorSpanText.includes(" ")) {
        const cursorSpanTextTokens = cursorSpanText.split(" ")
        previous = cursorSpanTextTokens[0]
        next = cursorSpanTextTokens[cursorSpanTextTokens.length - 1]
    } else {
        const previousEnd = cursorSpan.start - 1
        const previousStart = getLeft(sql, previousEnd, " ", true)
        previous = sql.substr(previousStart, previousEnd - previousStart)

        const nextStart = cursorSpan.end + 1
        const nextEnd = getRight(sql, nextStart, " ", true)
        next = sql.substr(nextStart, nextEnd - nextStart)
    }
    const cursorPosition = {
        start,
        index,
        end,
        cursorSpanText,
        previous,
        next
    }

    return { sql, cursorPosition }
}
