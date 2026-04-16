import csv

class Host:
    name = ""
    gender = ""
    email = ""
    phone = ""
    max_hostees = 1
    hostees = []

    def __init__(self, name, gender, email, phone, max_hostees, hostees, score):
        self.name = name
        self.gender = gender
        self.email = email
        self.phone = phone
        self.max_hostees = max_hostees
        self.hostees = hostees

    def toJSON(self):
        hosteesJson = []
        for hostee in self.hostees:
            hosteesJson.append(hostee.toJSON())

        return {
            "name": self.name,
            "gender": self.gender,
            "email": self.email.lower(),
            "phone": self.phone,
            "hostees": hosteesJson
        }

class Hostee:
    name = ""
    gender = ""
    email = ""
    phone = ""
    host = Host("", "", "", "", 1, [])
    pre_matched = False

    def __init__(self, name, gender, email, phone, host, pre_matched, score):
        self.name = name
        self.gender = gender
        self.email = email
        self.phone = phone
        self.host = host
        self.pre_matched = pre_matched

    def toJSON(self):
        return {
            "name": self.name,
            "gender": self.gender,
            "email": self.email,
            "phone": self.phone,
            "host": self.host.name
        }


all_hosts = []
all_hostees = []

host_reader = csv.reader(open("./input/hosts.csv", "r"), delimiter='|')
hostees_reader = csv.reader(open("./input/hostees.csv", "r"), delimiter=',')

for row in host_reader:
    person = Host(row[0], row[3], row[1], row[2], int(row[4]), [])
    all_hosts.append(person)

for row in hostees_reader:
    person = Hostee(row[0], row[3], row[1], row[2], Host("", "", "", "", 1, []), False)
    all_hostees.append(person)


male_hosts = []
male_hostees = []

female_hosts = []
female_hostees = []

for i in range(len(all_hosts)):
    if all_hosts[i].gender == "Male":
        male_hosts.append(all_hosts[i])
    elif all_hosts[i].gender == "Female":
        female_hosts.append(all_hosts[i])
    else:
        print("No gender found.")

for i in range(len(all_hostees)):
    if all_hostees[i].gender == "Male":
        male_hostees.append(all_hostees[i])
    elif all_hostees[i].gender == "Female":
        female_hostees.append(all_hostees[i])
    else: 
        print("No gender found.")


def find_host(name, hosts):
    for host in hosts:
        if host.name == name:
            return host

def find_hostee(name, hostees):
    for hostee in hostees:
        if hostee.name == name:
            return hostee

def pre_match(host_name, hostee_name, hosts, hostees):
    host = find_host(host_name, hosts)
    hostee = find_hostee(hostee_name, hostees)
    host.hostees.append(hostee)
    hostee.host = host
    hostee.pre_matched = True
    hostees.remove(hostee)

# For any host/hostee that requested a specific person, make those assignments here
# Ensure that the hostee is included in the host's list, and that the hostee's host is properly assigned
pre_match("Rifat Tarafder", "Moeen Razzaque", male_hosts, male_hostees)
pre_match("Rifat Tarafder", "Ibrahim Omeish", male_hosts, male_hostees)
pre_match("Rifat Tarafder", "Husam Elnager", male_hosts, male_hostees)

pre_match("Zain Anwar", "Zaid Ashruf", male_hosts, male_hostees)
pre_match("Zain Anwar", "Samir Nushin", male_hosts, male_hostees)
pre_match("Zain Anwar", "Imran Bahiru", male_hosts, male_hostees)

pre_match("Aziz Almat", "Melih Karaca", male_hosts, male_hostees)

pre_match("Husam Aiyash", "Ameen Kandathil", male_hosts, male_hostees)
pre_match("Husam Aiyash", "Yahya Alhusseinawi", male_hosts, male_hostees)
pre_match("Husam Aiyash", "Yasin Latif", male_hosts, male_hostees)
pre_match("Husam Aiyash", "Tayeb Rahman", male_hosts, male_hostees)
pre_match("Husam Aiyash", "Ezzaddin Aldaylam", male_hosts, male_hostees)

pre_match("Muhammad Ihsan Nuliadi", "Sadat Ahmed", male_hosts, male_hostees)
pre_match("Muhammad Ihsan Nuliadi", "Muhammad Gaziev", male_hosts, male_hostees)

pre_match("Hunter Robbins", "Abdul Wahab Cide Ali", male_hosts, male_hostees)
pre_match("Hunter Robbins", "Alae Saket", male_hosts, male_hostees)

pre_match("Kachi Ezuma-Ngwu", "Hassam Gani", male_hosts, male_hostees)
pre_match("Kachi Ezuma-Ngwu", "Ahmed Altunkaya", male_hosts, male_hostees)

pre_match("Fareed Salmon, Mikail Akbar, Rayaan Ali", "Albaraa Gebril", male_hosts, male_hostees)

pre_match("Sameer Bhatti", "Fahim Aseer", male_hosts, male_hostees)
pre_match("Sameer Bhatti", "Azneef Ahammed Chowdhury", male_hosts, male_hostees)
pre_match("Sameer Bhatti", "Saad Ashar", male_hosts, male_hostees)
pre_match("Sameer Bhatti", "Amir Alsad", male_hosts, male_hostees)
pre_match("Sameer Bhatti", "Adham Ibrahim", male_hosts, male_hostees)
pre_match("Sameer Bhatti", "Ali Noamany", male_hosts, male_hostees)


pre_match("Sahra Wahedi", "Nabiha Charolia", female_hosts, female_hostees)

pre_match("Aliaa Mahgoub", "Anisha Azizi", female_hosts, female_hostees)
pre_match("Aliaa Mahgoub", "Maisha Rahman", female_hosts, female_hostees)

pre_match("Samiya Mohamed", "Maida Mohamed", female_hosts, female_hostees)

pre_match("Heba Mohamed", "Noor Mohamed", female_hosts, female_hostees)
pre_match("Heba Mohamed", "Amber Khatib", female_hosts, female_hostees)
pre_match("Heba Mohamed", "Hilal Akman", female_hosts, female_hostees)
pre_match("Heba Mohamed", "Suheyla Akman", female_hosts, female_hostees)
pre_match("Heba Mohamed", "Shahd Nimir", female_hosts, female_hostees)

pre_match("Mariam Khan", "Hiba Chafoui", female_hosts, female_hostees)
pre_match("Mariam Khan", "Najwa Jelinek", female_hosts, female_hostees)

pre_match("Shukraat Adesina", "Fatima Mirghani", female_hosts, female_hostees)
pre_match("Shukraat Adesina", "Kabirah Azeez", female_hosts, female_hostees)

pre_match("Lidia Ghirmay", "Rahmatullah Jallow", female_hosts, female_hostees)

pre_match("Seline Mesfin", "Bana Conde", female_hosts, female_hostees)

pre_match("Adiyah Obolu", "Honey Hawre", female_hosts, female_hostees)

pre_match("Haerat Alabi, Lamia Ayaz", "Eeman Abakura", female_hosts, female_hostees)
pre_match("Haerat Alabi, Lamia Ayaz", "Amirah Oladoja", female_hosts, female_hostees)
pre_match("Haerat Alabi, Lamia Ayaz", "Amirah Adeleye", female_hosts, female_hostees)

pre_match("Biruni Hariadi, Ayaisha Alsaedi", "Looma Taha", female_hosts, female_hostees)

pre_match("Duaa Eldirdiri", "Sara Memon", female_hosts, female_hostees)

pre_match("Fagr Aboudaka", "Anaya Qayyum", female_hosts, female_hostees)
pre_match("Fagr Aboudaka", "Eva Kabatas", female_hosts, female_hostees)

pre_match("Fthia Yousif", "Doaa Adam", female_hosts, female_hostees)

pre_match("Salma Alouane", "jenna ghanimah", female_hosts, female_hostees)


def match(hosts, hostees):
    available = 0
    for host in hosts:
        available += (host.max_hostees - len(host.hostees)) # Max hostees - any prematched hostees
    if available < len(hostees):
        print(f'Not enough hosts. We have {len(hostees)} hostees and can only accommodate {available} people.')
        return
    else:
        print(f'Perfect! We have {len(hostees)} hostees, {available} spots, with {available - len(hostees)} spots remaining.\n')

    host_index = 0
    hostees_index = 0
    while hostees_index < len(hostees):
        if len(hosts[host_index].hostees) < hosts[host_index].max_hostees:
            hosts[host_index].hostees.append(hostees[hostees_index])
            hostees[hostees_index].host = hosts[host_index]
            hostees_index += 1
        elif len(hosts[host_index].hostees) > hosts[host_index].max_hostees:
            host_index += 1
            if host_index >= len(hosts):
                host_index = 0
            continue
        host_index += 1
        if host_index >= len(hosts):
            host_index = 0

match(male_hosts, male_hostees)
match(female_hosts, female_hostees)


f1 = open("./output/matches.txt", "w")
for k in range(len(male_hosts)):
    f1.write(f'Host: {male_hosts[k].name} | {male_hosts[k].email} | {male_hosts[k].phone}\n')
    for i in range(len(male_hosts[k].hostees)):
        f1.write(f'Hostee {i + 1}: {male_hosts[k].hostees[i].name} | {male_hosts[k].hostees[i].email} | {male_hosts[k].hostees[i].phone}\n')
    f1.write("\n")

for k in range(len(female_hosts)):
    f1.write(f'Host: {female_hosts[k].name} | {female_hosts[k].email} | {female_hosts[k].phone}\n')
    for i in range(len(female_hosts[k].hostees)):
        f1.write(f'Hostee {i + 1}: {female_hosts[k].hostees[i].name} | {female_hosts[k].hostees[i].email} | {female_hosts[k].hostees[i].phone}\n')
    f1.write("\n")
f1.close()

f2 = open("./output/pigeon.txt", "w")
for k in range(len(male_hosts)):
    f2.write(f'{male_hosts[k].name}\n')
    for i in range(len(male_hosts[k].hostees)):
        f2.write(f'{male_hosts[k].hostees[i].name}\n')

for k in range(len(female_hosts)):
    f2.write(f'{female_hosts[k].name}\n')
    for i in range(len(female_hosts[k].hostees)):
        f2.write(f'{female_hosts[k].hostees[i].name}\n')
f2.close()

for hostee in all_hostees:
    print(f'{hostee.name} | {hostee.host.name}')


final = f''

for host in all_hosts:
    hostees = f''
    for i in range(len(host.hostees)):
        if i == len(host.hostees) - 1:
            hostees += f'{host.hostees[i].name}'
        else:
            hostees += f'{host.hostees[i].name}, '
    final += f'{host.name}|{host.email}|{host.name}|{host.phone}|{host.email}|{hostees}\n'

for hostee in all_hostees:
    host = hostee.host
    hostees = f''
    for i in range(len(host.hostees)):
        if i == len(host.hostees) - 1:
            hostees += f'{host.hostees[i].name}'
        else:
            hostees += f'{host.hostees[i].name}, '
    final += f'{hostee.name}|{hostee.email}|{host.name}|{host.phone}|{host.email}|{hostees}\n'

f3 = open("./output/final.csv", "w")
f3.write(final)
f3.close()


json_objects = ""
for host in all_hosts:
    json_objects += f'\t{host.toJSON()},\n'
json_content = f'''[
{json_objects}
]'''

f4 = open("./output/final.json", "w")
f4.write(json_content)
f4.close()


if sum(1 for _ in open("./output/pigeon.txt")) == len(all_hosts) + len(all_hostees):
    print("Final matching is surjective.")
else:
    print("Final matching is not surjective. Double check host-hostee matches.")
