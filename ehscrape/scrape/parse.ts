import { assert } from "@std/assert/assert";
import { DOMParser, Element } from "jsr:@b-fuze/deno-dom";





export class ParsedEntry {


    public gid : number;
    public token : string;
    public tags_strong : string[];
    public tags_dashed : string[];
    

    constructor(gid : number, token : string, tags_strong : string[], tags_dashed : string[]) {
        this.gid = gid
        this.token = token;
        this.tags_strong = tags_strong;
        this.tags_dashed = tags_dashed;
    }

}

export class ParsedPage {
    public entries : ParsedEntry[];
    public prev : number;
    public next : number;
    constructor(entries : ParsedEntry[], prev : number, next : number) {
        this.entries = entries;
        this.prev = prev;
        this.next = next;
    }
}

export function parse_page(page : string) {
    const doc = new DOMParser().parseFromString(page, "text/html")
    const entries_table = doc.querySelector(".itg")?.children[0].children;
    
    assert(entries_table != undefined);
    const entries : ParsedEntry[] = [];
    for(const entry of entries_table) {

        const heuristic_attr = entry.children[0].getAttribute("class");
        //theres like a middle spacing thing here that fucks with this
        if(heuristic_attr == "itd")
            continue;
        const entry_info = entry.children[1].children[0];
        
        const href_elem = entry_info.children[1];
    
        const href_url = href_elem.getAttribute("href");
        //match gallery url id/token
        const href_match = href_url?.match("\/g\/([0-9]+)\/([0-9a-f]+)\/");
        assert(href_match != null && href_match.length == 3);

        const gid : number = +href_match[1];
        const token : string = href_match[2];

        const tags_table = href_elem.children[0].children[1].children[0].children[0].children;
        const tags_strong : string[] = []
        const tags_dashed : string[] = []
        //holy shit i hate this 
        for(const tags_namespaces of tags_table) {
            for(const tags_elem of tags_namespaces.children[1].children) {
                const strength = tags_elem.getAttribute("class");
                const val = tags_elem.getAttribute("title");
                
                assert(val != null);
                assert(strength == "gtl" || strength == "gt");

                if( strength == "gtl")
                    tags_dashed.push(val);
                else
                    tags_strong.push(val)
            }
        }
        entries.push(new ParsedEntry(gid, token, tags_strong, tags_dashed))


    }
    const searchnav = doc.querySelector(".searchnav");
    const prev_url = searchnav?.children[2].children[0].getAttribute("href");
    let prev = -1, next = -1;
    //match prev/next urls
    if(prev_url != null) {
        
        const prev_match = prev_url.match("prev=([1-9]+)")
        assert(prev_match != null && prev_match.length == 2);
        prev = +prev_match[2];
    }
    
    const next_url = searchnav?.children[4].children[0].getAttribute("href");
    if(next_url != null) {
        const next_match = next_url.match("next=([1-9]+)")
        assert(next_match != null && next_match.length == 2);
        next = +next_match[1];
        
    }

    return new ParsedPage(entries, prev, next)


}