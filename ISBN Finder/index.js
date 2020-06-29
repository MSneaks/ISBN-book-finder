/*
=-=-=-=-=-=-=-=-=-=-=-=-
Final Project
=-=-=-=-=-=-=-=-=-=-=-=-
Student ID:15277138




=-=-=-=-=-=-=-=-=-=-=-=-
*/

const fs = require("fs");
const url = require('url');
const http = require('http');
const https = require('https');
const querystring = require('querystring');
const port = 3000;
const server = http.createServer();
const credentials = require('./auth/client.json');
const google_auth_cache = './auth/authentication-res.json';


server.on("request", connection_handler);
server.on("listening", listening_handler);
server.listen(port);
let user_input = "";
let img_directory="";
let cache = []
//connection handler
function connection_handler(req, res){
	console.log(`New Request for ${req.url} from ${req.socket.remoteAddress}`);
	
	if(req.url === "/")
	{
		/*I dynamically generate the homepage every time it is requested. I dont have to do this, I can just
		include the submit button link in the href. The submit button will send me to the google api to get permission
		to use the service. This will send a auth code in the redirected url(localhost://3000/upload).I will have
		to grab the auth code in order to request tokens. The URL embedded into the submit button should only be unique
		to the server.
		*/
		let codeurl = get_code_url()
		generate_home_page(codeurl,res);
	}

	else if (req.url.startsWith("/upload"))
		{
		let t = req.url
		//our redirect uri takes us here. The auth code we need is in the url. We can aquire our tokens
			t = t.substring(13)
			let code_array = t.split("&")
			let code = code_array[0]
			console.log(code);
			//creates a token request
			create_token_request(code,res);
		
		//writes the submission form
		//calling read from within write to make sure page is created in directory first
			let main =  fs.createReadStream('html/form.html');
			res.writeHead(200,{'Content-Type':'text/html'});
			main.pipe(res);
			

		}
	else if (req.url.startsWith("/ISBN"))
	{
		//From here we need to get the url for our isbn. We split up our user response
		user_input = (url.parse(req.url,true).path);
		console.log(" isbn: " + user_input)
		//this will validate isbn and return valid output
		let isbn = parse_user_input(user_input,res);
		console.log("ISBN "+isbn)
		//console.log("See image at " + img_url);
		request_image(isbn,res);
		
		
	}
	else 
	{
		deliver_404(res);
	}
	
	
}


function listening_handler(){
	console.log(`Now Listening on Port ${port}`);
}

function deliver_404(res)
{
	res.writeHead(404, {"Content-Type": "text/plain"});
	res.write("404 Not Found");
	res.end();
}

function parse_user_input(isbn,res)
{
	isbn= isbn.substring(11)
//	console.log(" isbn2: " + isbn)
//	console.log(isbn)
	//isbn =parseInt(isbn, 10)
	//console.log(isbn);
	if (/^\d+$/.test(isbn))
	{
		if((isbn.length ==10 )|| (isbn.length==13))
		{
			isbn ='ISBN:'+isbn
			return isbn
		}
		else
		{
			deliver_404(res)
		}
	}
	else
	{
		deliver_404(res);
	}
	
	
}

function request_image(isbn,res)
{
	//crafting library endpoint
	let library_endpoint = "https://openlibrary.org/api/books?bibkeys="+isbn+"&jscmd=data&format=json"
	
	let request = https.get(library_endpoint, function(book_res){
		//I have received my image so I can send a reuqest to google drive
		process_request(book_res,isbn,res);
	});		
	request.end();
	  
}

function process_request(book_res,isbn,res)
{
	//grab request info
	let book_data = "";
	book_res.on("data",chunk => book_data += chunk);
	book_res.on("end",()=>upload_request(book_data,isbn,res))
}


function upload_request(book_data,isbn,res)
{
	//normally I would parse to JSON here and extract some usefl info but I was having a hard time working with the JSON object

	
	goog_auth = require(google_auth_cache)
	


		let drive = "https://www.googleapis.com/upload/drive/v3/files?uploadType=media";


		var fileMetadata = {body:book_data}
		
		let pd_string = querystring.stringify(book_data);
		
		const options =
		{
			method: 'POST',
			headers:{"Content-Type":"text/plain",
			"Content-Length":book_data.length,
			"Authorization": "Bearer " + goog_auth.access_token,
			}
		}
			
	let auth_req = https.request(drive, options, function(upload_res){
		received_upload(upload_res)
		
	});
	auth_req.on('error',function(e){
		console.error(e);
	});
	console.log("Attempting Upload");
	auth_req.end(book_data);
			
}


const received_upload = function(upload_res){
	upload_res.setEncoding("utf8");
	let body = "";
	upload_res.on("data", function(chunk) {body +=chunk;});
	upload_res.on("end",function(){
		let upload_body = JSON.parse(body);
		console.log("Uploaded");

	});
};



function create_token_request(auth_code,res)
{
	//check if we have a valid token already
	let cache_valid = false;
	//if there is a cache...
	if(fs.existsSync(google_auth_cache))
	{
		cached_auth = require(google_auth_cache);
		
		//and cache is younger than expiration
		if(new Date(cached_auth.expiration)> Date.now())
		{
			//we can use cache
			cache_valid = true;
			console.log("cache valid");
		}
		
		else
		{
			//otherwise let use know cache is invalid
			console.log(user_input);
			console.log("Token Expired");
		}
	}
	//if there is no cache we should generate it
	else
	{
		const data = "";
		fs.writeFile('./auth/authentication-res.json', data, (err) => {
		if (err) throw err;
			console.log('The cache has been created!');
		});
	}
	
	//if cache is valid we can go right to a request we dont have to do anything
	if(cache_valid)
	{
	}
	
	//if not we should aquire new credentials
	else
	{
		//similar to what we do in spotify.Specify our fields
		var post_data = {"grant_type" : "authorization_code",
			"code" : auth_code,
			
			'client_id': credentials.web.client_id,
			'redirect_uri': credentials.web.redirect_uris,
			'client_secret': credentials.web.client_secret
		}
		let pd_string = querystring.stringify(post_data);
		const options =
		{
			method: 'POST',
			headers:{"Content-Type":"application/x-www-form-urlencoded",
			
			}

		}
		let token_endpoint = "https://accounts.google.com/o/oauth2/token"
		
		let authentication_req = https.request(token_endpoint, options, function(authentication_res){
			received_authentication(authentication_res,res);
			
		});
			authentication_req.on('error',function(e){
				console.error(e);
		});
		console.log("Requesting Token");
		authentication_req.end(pd_string);
		
	}
}


const received_authentication = function(authentication_res,img_directory,res){
	authentication_res.setEncoding("utf8");
	let body = "";
	authentication_res.on("data", function(chunk) {body +=chunk;});
	authentication_res.on("end",function(){
		let google_auth = JSON.parse(body);
		console.log(google_auth);
		//So this does come with a refresh token. It changes whenever I sign in though so I won't work with it for now.I just use the access token
		if (typeof google_auth_cache.access_token === 'undefined'){
					let request_sent_time = Date.now()
		google_auth.expiration = request_sent_time + 3599999;
		create_access_token_cache(google_auth);}
		
		
	});
	
};

function create_access_token_cache(google_auth)
{	
//if i request a token while mine is valid(such as from refreshing the page when i get a token),the program
//would write over my credentials file. The if-else is to prevent that
	if(google_auth.error === "invalid_grant")
	{
		return
	}
	else{
		//write to my cache
	var sp = JSON.stringify(google_auth);
	fs.writeFile(google_auth_cache,sp, (err)=>{
		if (err) throw err;
		console.log("File Saved");
	});
	console.log(google_auth_cache.access_token);}
	
	
}


function get_code_url()
{
	let redirect_uri = credentials.web.redirect_uris;
	let client_id = credentials.web.client_id;
	let google_auth_code_url = "https://accounts.google.com/o/oauth2/auth?scope=https://www.googleapis.com/auth/drive&response_type=code&access_type=offline&prompt=consent&redirect_uri="+redirect_uri+"&client_id="+client_id
	return google_auth_code_url
	
}
function generate_home_page(code_url,res)
{
	let t = ""
	t+='<html><body><h2>Allow access to google drive to continue with app</h2>'
	t+= "<a href="+code_url+">Submit</a>"
	t+='</form> </body></html>'
	let home_page = 'html/home.html'
	fs.writeFile(home_page,t, (err)=>{
			if (err) throw err;
			console.log("File Saved");
			//calling read from within write to make sure page is created in directory first
				let main =  fs.createReadStream(home_page);
				res.writeHead(200,{'Content-Type':'text/html'});
				main.pipe(res);
		});
}


//These are functions that I took out during the process. Keeping in case I need to reuse logic

//create html page text
/*
function create_page(user_url,code_url)
{
	console.log(code_url);
	let t = "<h1>" + user_url+ "</h1>"
	t += '<img src = "' + user_url+ '">';
	t+="<br><br>";
	t+= "<a href='/'>back</a>"
	t+= "<br/> <br/>"
	t+= "<a href="+code_url+">Save Image</a>"

	return t;
}
*/
/*
//either generate or serve html 
function generate_webpage(user_url,name,gender, res,code_url)
{
	let img_page = 'avatar/'+name+ "_" + gender+'.html'
	//cache
	if(cache.includes(img_page))
	{
		let main =  fs.createReadStream(img_page);
		res.writeHead(200,{'Content-Type':'text/html'});
		main.pipe(res);
		
		console.log("cache");
	}
	
	else
	{
		//ill create the page in a seperate function
		let t = create_page(user_url,code_url)
	//using write file to make html page and 
			fs.writeFile(img_page,t, (err)=>{
			if (err) throw err;
			console.log("File Saved");
			//calling read from within write to make sure page is created in directory first
				let main =  fs.createReadStream(img_page);
				res.writeHead(200,{'Content-Type':'text/html'});
				main.pipe(res);
		});
		cache.push(img_page)
		console.log("new");
	}
	return img_page
}
*/

/*
function code_request(code_url)
{
	console.log(code_url);
	let auth_address = "https://accounts.google.com/o/oauth2/auth"
	var post_data = 
	{
		"grant_type":"Authorization Code",
		"Authorization URL": "https://accounts.google.com/o/oauth2/auth",
		"Access Token URL" : "https://oauth2.googleapis.com/token",
		"Client Id" : credentials.web.client_id,
		"Redirect URL": "http://localhost:3000/upload",
		"Scope" : "https://www.googleapis.com/auth/drive",
	
	}
	let post_string = querystring.stringify(post_data);
	const options =
		{
			header:{
				Location: code_url
			}
	
		}
	let authentication_req = https.get(code_url, function(redirect_code){
		received_code_request(redirect_code);
		//console.log(redirect_code);
			
	});
//	authentication_req.end(post_string);

}
const received_code_request = function(redirect_code){
	redirect_code.setEncoding("utf8");
	let body = "";
	redirect_code.on("data", function(chunk) {body +=chunk;});
	redirect_code.on("end",function(){
		let code_url = url.parse(body);
		console.log(code_url);
		console.log(body)
	});
	
};

//create url for dicebears
function create_url(name,gender)
{
	a_url = ""
	a_url = avatar_website + gender + "/" + name + ".svg"
	return a_url;
}


*/
