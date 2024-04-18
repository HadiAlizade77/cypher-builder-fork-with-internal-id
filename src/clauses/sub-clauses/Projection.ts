/*
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [http://neo4j.com]
 *
 * This file is part of Neo4j.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { CypherEnvironment } from "../../Environment";
import type { Expr } from "../../types";
import { CypherASTNode } from "../../CypherASTNode";
import type { Variable } from "../../references/Variable";
import type { Literal } from "../../references/Literal";

export type ProjectionColumn = Expr | [Expr, string | Variable | Literal];

export class Projection extends CypherASTNode {
    private columns: ProjectionColumn[] = [];
    private isStar = false;

    constructor(columns: Array<"*" | ProjectionColumn>) {
        super();

        this.addColumns(columns);
    }

    public addColumns(columns: Array<"*" | ProjectionColumn>): void {
        const filteredColumns = columns.filter((v) => {
            if (v === "*") {
                this.isStar = true;
                return false;
            }
            return true;
        }) as ProjectionColumn[];
        this.columns.push(...filteredColumns);
    }

    /** @internal */
    public getCypher(env: CypherEnvironment): string {
        let columnsStrs = this.columns.map((column) => {
            return this.serializeColumn(column, env);
        });

        // Only a single star at the beginning is allowed
        if (this.isStar) {
            columnsStrs = ["*", ...columnsStrs];
        }

        return columnsStrs.join(", ");
    }

    private serializeColumn(column: ProjectionColumn, env: CypherEnvironment): string {
        const hasAlias = Array.isArray(column);
        if (hasAlias) {
            const exprStr = column[0].getCypher(env);
            // const varNameRegex = /this(?:\*?\d+)?/g;
            // const varName = exprStr.match(varNameRegex)?.[0] ?? ''
            const idRegexPattern = /(id:\s*this(\d+)\.id|\.id)/g;
            const idReplacedString = exprStr.replace(idRegexPattern, (match, idMatch, idNumber) => {
                if (idMatch) {
                    // If the match is for an id pattern
                    return `id: id(this${idNumber ?? ""})`;
                }
                // Return the original match if it doesn't match either pattern
                return match;
            });

            const labelRegexPattern = /(labels:\s*this(\d+)\.labels|\.labels)/g;
            const replacedString = idReplacedString.replace(labelRegexPattern, (match, labelMatch, labelNumber) => {
                if (labelMatch) {
                    // If the match is for an id pattern
                    return `labels: labels(this${labelNumber ?? ""})`;
                }
                // Return the original match if it doesn't match either pattern
                return match;
            });

            const alias = column[1];
            let aliasStr;
            if (typeof alias === "string") {
                aliasStr = alias;
            } else {
                aliasStr = alias.getCypher(env);
            }
            return `${replacedString} AS ${aliasStr}`;
        }
        const cypher = column.getCypher(env);
        const idRegexPattern = /(id:\s*this(\d+)\.id|\.id)/g;
        const idReplacedString = cypher.replace(idRegexPattern, (match, idMatch, idNumber) => {
            if (idMatch) {
                // If the match is for an id pattern
                return `id: id(this${idNumber ?? ""})`;
            }
            // Return the original match if it doesn't match either pattern
            return match;
        });

        const labelRegexPattern = /(labels:\s*this(\d+)\.labels|\.labels)/g;
        const replacedString = idReplacedString.replace(labelRegexPattern, (match, labelMatch, labelNumber) => {
            if (labelMatch) {
                // If the match is for an id pattern
                return `labels: labels(this${labelNumber ?? ""})`;
            }
            // Return the original match if it doesn't match either pattern
            return match;
        });

        return replacedString;
    }
}
